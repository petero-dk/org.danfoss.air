import Homey from 'homey';
import { DanfossAir, ParamData } from 'danfoss-air-api';

module.exports = class DanfossAirDevice extends Homey.Device {

  private danfossAir?: DanfossAir = undefined;
  private currentFanStep?: number;
  private modeSwitchTimeout?: NodeJS.Timeout;
  private reinitTimeout?: NodeJS.Timeout;
  private isInitializing: boolean = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private homeyLog: {
    captureMessage: (msg: string, context?: Record<string, unknown>) => void;
    captureException: (err: unknown, context?: Record<string, unknown>) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = (this.homey.app as any).homeyLog;

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    try {
      this.log('Danfoss Air has been initialized');
      await this.setUnavailable().catch(this.error);

      const settings = this.getSettings();
      this.log('Hostname:', settings.hostname);
      if (settings.hostname) {
        await this.deviceInit();

        this.registerCapabilityListener('fan_mode', async (value) => {
          this.log('Setting value', 'fan_mode', value);
          let mode = 0;
          switch (value) {
            case 'demand':
              mode = 0;
              break;
            case 'program':
              mode = 1;
              break;
            case 'manual':
              mode = 2;
              break;
            default:
              mode = 0;
              break;
          }
          if (this.modeSwitchTimeout) {
            clearTimeout(this.modeSwitchTimeout);
          }
          this.modeSwitchTimeout = this.homey.setTimeout(() => {
            this.log('Cleared the mode switch timer');
            this.modeSwitchTimeout = undefined;
          }, 6000);
          await this.danfossAir?.setMode(mode).catch(this.error);
        });

        this.registerCapabilityListener('fan_speed.step', async (value) => {
          this.log('Setting value', 'fan_speed.step', value);
          await this.danfossAir?.setFanStep(Math.min(10, Math.max(1, Math.floor((value as number) / 10)))).catch(this.error);
        });

        this.registerCapabilityListener('onoff.boost', async (value) => {
          this.log('Setting value', 'onoff.boost', value);
          if (value as boolean) {
            await this.danfossAir?.activateBoost().catch(this.error);
          } else {
            await this.danfossAir?.deactivateBoost().catch(this.error);
          }
        });

        this.registerCapabilityListener('onoff.bypass', async (value) => {
          this.log('Setting value', 'onoff.bypass', value);
          await this.danfossAir?.writeParameterValue('bypass', (value as boolean)).catch(this.error);
        });

        this.registerCapabilityListener('onoff.automatic_bypass', async (value) => {
          this.log('Setting value', 'onoff.automatic_bypass', value);
          await this.danfossAir?.writeParameterValue('automatic_bypass', (value as boolean)).catch(this.error);
        });
      }
      await this.updateFanStep(false);
    } catch (error) {
      this.error('Error occurred during initialization:', error);
      this.homeyLog.captureException(error);
    }
  }

  async restartInit() {
    // Clear any existing reinit timeout to prevent multiple reinit attempts
    if (this.reinitTimeout) {
      this.log('Clearing existing reinit timeout');
      clearTimeout(this.reinitTimeout);
      this.reinitTimeout = undefined;
    }

    // If already initializing, don't start another one
    if (this.isInitializing) {
      this.log('Already initializing, skipping restart request');
      return;
    }

    try {
      await this.setUnavailable();
      this.cleanupDanfossInstance();
    } catch (error) {
      this.error('Error during Danfoss Air device cleanup before restart:', error);
    }

    // Schedule a single reinit attempt
    this.reinitTimeout = this.homey.setTimeout(async () => {
      this.reinitTimeout = undefined;
      try {
        this.log('Restarting Danfoss Air device initialization');
        this.homeyLog.captureMessage('Restarting Danfoss Air device initialization');
        await this.deviceInit();
      } catch (error) {
        this.error('Error during Danfoss Air device restart initialization:', error);
        this.homeyLog.captureException(error);
        this.homeyLog.captureMessage('Reinit failed, will retry in 30 seconds');
        // Schedule another restart, which will clear any existing timeout
        this.restartInit().catch(this.error);
      }
    }, 30000);
  }

  private cleanupDanfossInstance() {
    if (this.danfossAir) {
      this.log('Cleaning up existing Danfoss Air instance');
      try {
        this.danfossAir.cleanup();
      } catch (error) {
        this.error('Error during cleanup:', error);
      }
      this.danfossAir = undefined;
    }
  }

  async deviceInit() {
    // Prevent concurrent initialization attempts
    if (this.isInitializing) {
      this.log('Device initialization already in progress, skipping');
      return;
    }

    this.isInitializing = true;

    try {
      // Clean up any existing instance first
      this.cleanupDanfossInstance();

      const settings = this.getSettings();
      this.danfossAir = new DanfossAir({
        ip: settings.hostname,
        continueOnError: true,
        delaySeconds: 5,
        debug: false,
        singleCallbackFunction: (data: ParamData) => {
          this.onDanfossMessage(data).catch(this.error);
        },
        errorCallback: (error: Error, type: string) => {
          this.error('Danfoss Air write error:', error);
          this.homeyLog.captureMessage('Error callback from Danfoss Api', {
            context: {
              demo: '1',
              type,
              exception: error,
              json: JSON.stringify(error),
            },
          });
          this.homeyLog.captureException(error, {
            context: {
              demo: '1',
              type,
              exception: error,
              json: JSON.stringify(error),
            },
          });
          // Only restart if we're not already in a reinit process
          if (!this.reinitTimeout) {
            this.restartInit().catch(this.error);
          }
        },
      });
      await this.danfossAir.start();

      const serialNumberHigh = this.danfossAir.getParameter('unit_serialnumber_high_word');
      const serialNumberLow = this.danfossAir.getParameter('unit_serialnumber_low_word');

      if (!serialNumberHigh || !serialNumberLow) {
        throw new Error('Sanity check failed: Serial numbers are not available');
      }

      const serialNumber = (serialNumberHigh.value as number << 16) | (serialNumberLow.value as number & 0xFFFF);
      this.log('Found device with serial number:', serialNumber);
      await this.setAvailable();

      // Clear the initialization flag on success
      this.isInitializing = false;
    } catch (error) {
      this.isInitializing = false;
      this.error('Error occurred during device initialization:', error);
      this.homeyLog.captureException(error);
      throw error; // Re-throw to let caller handle it
    }
  }

  async updateFanStep(hasFanStep: boolean) {
    if (hasFanStep && !this.hasCapability('fan_speed.step')) {
      await this.addCapability('fan_speed.step').catch(this.error);
      if (this.currentFanStep) {
        await this.setCapabilityValue('fan_speed.step', (this.currentFanStep) * 10).catch(this.error);
      }
    }
    if (!hasFanStep && this.hasCapability('fan_speed.step')) {
      await this.removeCapability('fan_speed.step').catch(this.error);
    }
  }

  async onDanfossMessage(data: ParamData) {
    switch (data.id) {
      case 'humidity_measured_relative':
        await this.setCapabilityValue('measure_humidity', data.value).catch(this.error);
        break;
      case 'operation_mode': {
        let mode = 'demand';
        switch (data.value) {
          case 1:
            mode = 'program';
            break;
          case 2:
            mode = 'manual';
            break;
          default:
            mode = 'demand';
            break;
        }

        if (!this.modeSwitchTimeout) {
          await this.setCapabilityValue('fan_mode', mode).catch(this.error);
          await this.updateFanStep(data.value === 2);
        } else {
          this.log('Skipping setting fan mode to', mode, 'because we are in a mode switch timeout');
        }
        break;
      }
      case 'bypass':
        await this.setCapabilityValue('onoff.bypass', (data.value as boolean)).catch(this.error);
        break;
      case 'automatic_bypass':
        await this.setCapabilityValue('onoff.automatic_bypass', (data.value as boolean)).catch(this.error);
        break;
      case 'boost':
        await this.setCapabilityValue('onoff.boost', (data.value as boolean)).catch(this.error);
        break;
      case 'fan_step':
        this.currentFanStep = data.value as number;
        if (this.hasCapability('fan_speed.step')) {
          await this.setCapabilityValue('fan_speed.step', (data.value as number) * 10).catch(this.error);
        }
        break;
      case 'fanspeed_supply_actual':
        this.setCapabilityValue('measure_rpm.supply', data.value).catch(this.error);
        break;
      case 'fanspeed_extract_actual':
        this.setCapabilityValue('measure_rpm.extract', data.value).catch(this.error);
        break;
      case 'battery_indication_percent':
        this.setCapabilityValue('measure_battery', data.value).catch(this.error);
        break;
      case 'filter_remaining':
        this.setCapabilityValue('measure_hepa_filter', data.value).catch(this.error);
        break;

      case 'temperature_room':
        this.setCapabilityValue('measure_temperature.inside', data.value).catch(this.error);
        break;
      case 'temperature_room_calc':
        this.setCapabilityValue('measure_temperature.inside_calculated', data.value).catch(this.error);
        break;

      case 'defrost_status':
        await this.setCapabilityValue('alarm_generic.defrosting', (data.value as boolean)).catch(this.error);
        break;
      case 'temperature_outdoor':
        this.setCapabilityValue('measure_temperature.outdoor', data.value).catch(this.error);
        break;
      case 'temperature_supply':
        this.setCapabilityValue('measure_temperature.supply', data.value).catch(this.error);
        break;
      case 'temperature_extract':
        this.setCapabilityValue('measure_temperature.extract', data.value).catch(this.error);
        break;
      case 'temperature_exhaust':
        this.setCapabilityValue('measure_temperature.exhaust', data.value).catch(this.error);
        break;
      case 'total_running_minutes':
      case 'unit_hardware_revision':
      case 'unit_software_revision':
        // Ignore these, we know them but don't care about them
        break;
      default:
        this.log('Unknown Danfoss Air data received:', JSON.stringify(data, null, 2));
    }
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('Danfoss Air Device has been added');
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({
    oldSettings,
    newSettings,
    changedKeys,
  }: {
    oldSettings: {
      [key: string]: boolean | string | number | undefined | null
    };
    newSettings: { [key: string]: boolean | string | number | undefined | null };
    changedKeys: string[];
  }): Promise<string | void> {
    this.log('Danfoss Air settings where changed');

    if (changedKeys.includes('hostname')) {
      // Clear any pending reinit
      if (this.reinitTimeout) {
        clearTimeout(this.reinitTimeout);
        this.reinitTimeout = undefined;
      }

      this.cleanupDanfossInstance();

      if (newSettings.hostname) {
        await this.deviceInit();
      }
    }

  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name: string) {
    this.log('Danfoss Air was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    // Clear any pending reinit timeout
    if (this.reinitTimeout) {
      clearTimeout(this.reinitTimeout);
      this.reinitTimeout = undefined;
    }

    // Clear mode switch timeout
    if (this.modeSwitchTimeout) {
      clearTimeout(this.modeSwitchTimeout);
      this.modeSwitchTimeout = undefined;
    }

    this.cleanupDanfossInstance();
    this.log('Danfoss Air has been deleted');
  }

};
