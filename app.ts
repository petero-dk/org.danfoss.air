'use strict';

import Homey from 'homey';

const { Log } = require('homey-log');

module.exports = class DanfossApp extends Homey.App {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  homeyLog: any;

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.homeyLog = new Log({ homey: this.homey });
    this.log('Danfoss Air App has been initialized');
  }
};
