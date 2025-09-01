import Homey from 'homey';
import PairSession from 'homey/lib/PairSession';

module.exports = class MyDriver extends Homey.Driver {

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('MyDriver has been initialized');
  }

  async onPair(session: Homey.Driver.PairSession): Promise<void> {
    
        var devices : any[] = [];

        session.setHandler("get_devices", async (data: any) => {

            //TODO: GET unique identifier
            var devData = {
                id: data.id,
                ipadr: data.ipaddress,
                macadr: "00:07:68:00:00"
            };
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
      //   name: 'My Device',
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
