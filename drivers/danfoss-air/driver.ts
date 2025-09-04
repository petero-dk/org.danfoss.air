import { DanfossAir } from 'danfoss-air-api';
import Homey from 'homey';
import PairSession from 'homey/lib/PairSession';

module.exports = class DanfossAirDriver extends Homey.Driver {

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('DanfossAir Driver has been initialized');
  }

  async onPair(session: Homey.Driver.PairSession): Promise<void> {

    var devices: any[] = [];

    session.setHandler("get_devices", async (data: any) => {

      let devData: {
        id: number;
        ipadr: any;
        macadr: string;
      } | null = null;

      try {

        const danfossAir = new DanfossAir({
          ip: data.ipaddress,
          delaySeconds: 5,
          debug: false
        });
        await danfossAir.start();


        const serialNumberHigh = danfossAir.getParameter('unit_serialnumber_high_word');
        const serialNumberLow = danfossAir.getParameter('unit_serialnumber_low_word');

        if (!serialNumberHigh || !serialNumberLow) {
          throw new Error('Sanity check failed: Serial numbers are not available');
        }


        const serialNumber = (serialNumberHigh.value as number << 16) | (serialNumberLow.value as number & 0xFFFF);
        this.log('Found device with serial number:', serialNumber);

        //TODO: GET unique identifier
        devData = {
          id: serialNumber,
          ipadr: data.ipaddress,
          macadr: "00:07:68:00:00"
        };
      } catch (error) {
        this.log("Not a real Danfoss Air device:", error);
      }
      if (devData != null) {
        var deviceDescriptor = {
          "name": data.deviceName,
          "data": {
            "id": devData.id,
            "ipadr": data.ipaddress
          },
          "settings": {
            "hostname": data.ipaddress
          }
        };
        devices.push(deviceDescriptor);
        session.emit("found", null);
      } else {
        session.emit("not_found", null);
      }
    });

    session.setHandler("list_devices", async (data: any) => {
      return devices;
    });
  }

  /**
   * onPairListDevices is called when a user is adding a device and the 'list_devices' view is called.
   * This should return an array with the data of devices that are available for pairing.
   */
  async onPairListDevices() {
    return [
      // Example device data, note that `store` is optional
      // {
      //   name: 'DanfossAir Device',
      //   data: {
      //     id: 'my-device',
      //   },
      //   store: {
      //     address: '127.0.0.1',
      //   },
      // },
    ];
  }

};
