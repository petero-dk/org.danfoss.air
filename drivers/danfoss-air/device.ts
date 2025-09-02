import Homey from 'homey';
import { DanfossAir, init, ParamData } from 'danfoss-air-api'


module.exports = class MyDevice extends Homey.Device {

  private danfossAir?: DanfossAir = undefined;

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.log('Danfoss Air has been initialized');

    const settings = this.getSettings();
    console.log(settings.hostname);
    if (settings.hostname) {

      this.danfossAir = new DanfossAir({
        ip: settings.hostname,
        delaySeconds: 5,
        debug: false,
        singleCallbackFunction: (data: ParamData) => {
          this.onDanfossMessage(data);
        }
      });
      this.danfossAir.start();

      this.registerCapabilityListener('fan_mode', async (value) => {
        this.log('Setting value', 'fan_mode', value);
        var mode = 0;
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
        }
        await this.danfossAir?.setMode(mode);
      });
      this.registerCapabilityListener('fan_speed.step', async (value) => {
        this.log('Setting value', 'fan_speed.step', value);
        await this.danfossAir?.setFanStep(Math.min(10, Math.max(1, Math.floor((value as number) / 10))));
      });
      this.registerCapabilityListener('onoff.boost', async (value) => {
        this.log('Setting value', 'onoff.boost', value);
        if (value as boolean) {
          await this.danfossAir?.activateBoost();
        } else {
          await this.danfossAir?.deactivateBoost();
        }
      });
    }
  }
  onDanfossMessage(data: ParamData) {
    switch (data.id) {
      case 'humidity_measured_relative':
        this.setCapabilityValue('measure_humidity', data.value).catch(this.error);
        break;
      case 'operation_mode':
        var mode = 'demand';
        switch (data.value) {
          case 1:
            mode = 'program'
            break;
          case 2:
            mode = 'manual'
            break;
        }
        this.setCapabilityValue('fan_mode', mode).catch(this.error);
        break;
      case 'boost':
        this.setCapabilityValue('onoff.boost', (data.value as boolean)).catch(this.error);
        break;
      case 'fan_step':
        this.setCapabilityValue('fan_speed.step', (data.value as number) * 10).catch(this.error);
        break;
      case 'fanspeed_supply_actual':
        this.setCapabilityValue('measure_speed.supply', data.value).catch(this.error);
        break;
      case 'fanspeed_extract_actual':
        this.setCapabilityValue('measure_speed.extract', data.value).catch(this.error);
        break;
      case 'total_running_minutes':

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
      case 'boost':

        break;
      case 'defrost_status':

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
    oldSettings: { [key: string]: boolean | string | number | undefined | null };
    newSettings: { [key: string]: boolean | string | number | undefined | null };
    changedKeys: string[];
  }): Promise<string | void> {
    this.log("Danfoss Air settings where changed");

    if (changedKeys.includes('hostname')) {
      if (this.danfossAir) {
        this.danfossAir.cleanup();
      }
      if (newSettings.hostname) {
        this.danfossAir = new DanfossAir({
          ip: newSettings.hostname as string,
          delaySeconds: 5,
          debug: false,
          singleCallbackFunction: (data: ParamData) => {
            this.onDanfossMessage(data);
          }
        });
        this.danfossAir.start();
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
    if (this.danfossAir) {
      this.danfossAir.cleanup();
    }
    this.log('Danfoss Air has been deleted');
  }

};
