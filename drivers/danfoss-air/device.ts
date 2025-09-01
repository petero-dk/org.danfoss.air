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
    }
  }

  onDanfossMessage(data: ParamData) {
    this.log('Danfoss Air data received:', JSON.stringify(data, null, 2));
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('MyDevice has been added');
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
    this.log('Danfoss Air has been deleted');
  }

};
