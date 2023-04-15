import { defineStore } from 'pinia'
import {ref} from "vue";
import {hex} from "../util.js";
import { getUsbInfo } from "../usb-ids.js"

const vid_pid = (port) => {
  const info = port.getInfo()
  return hex(info.usbVendorId) + ':' + hex(info.usbProductId)
}
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const bleNusServiceUUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const bleNusCharRXUUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const bleNusCharTXUUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
const MTU = 20;

const useConnectionStore = defineStore({
  id: 'connection',
  state: () => ({
    id: undefined,
    vendor: undefined,
    product: undefined,
    port: undefined,
    physicallyConnected: false,
    open: false,
    _reader: undefined,

    bleDevice: undefined,
    bleDevices: undefined,
    bleServer: undefined,
    nusService: undefined,
    rxCharacteristic: undefined,
    txCharacteristic: undefined,
    bleConnected: false,
    bleName: undefined,
    bleID: undefined,

    options: {
      baudRate: ref(115200),
      bufferSize: ref(255),
      dataBits: ref(8),
      flowControl: ref("none"),
      parity: ref("none"),
      stopBits: ref(1)
    },
    signals: {},
    messages: [],
    prepend: '',
    append: '\n'
  }),
  getters: {
  },
  actions: {
    selectDevice() {
      if (this.bleConnected) {
        console.log('Gone into disconnect()')
        this.bleDisconnect();
      } else {
        console.log('Gone into connect()')
        this.bleConnect();
      }
    },

    async bleConnect(){
      if (!navigator.bluetooth) {
        console.log('WebBluetooth API is not available.\r\n' +
          'Please make sure the Web Bluetooth flag is enabled.');
        window.term_.io.println('WebBluetooth API is not available on your browser.\r\n' +
          'Please make sure the Web Bluetooth flag is enabled.');
        return;
      }

      console.log('Requesting Bluetooth Device...');
      const device = await navigator.bluetooth.requestDevice({ //returns a Promise to a BluetoothDevice
        // these are all options for the bluetooth device / options for the device request
        //filters: [{services: []}]
        optionalServices: [bleNusServiceUUID], //An array of BluetoothServiceUUIDs
        acceptAllDevices: true //A boolean value indicating that the requesting script can accept all Bluetooth devices
      })
      alert('Found ' + device.name + ' ' + device.id);
      console.log('reached1');

      // window.location.search = `?bid=${device.id}`
      // alert(window.search.location)

      this.bleID = device.id

      // const bleDevices = await navigator.bluetooth.getDevices()
      // console.log(bleDevices)
      // this.bleDevice = bleDevices.find((port) => port.id === id)
      this.bleDevice = device   

      try{
        console.log('Connecting to GATT Server...');
        this.bleDevice.addEventListener('gattserverdisconnected', this.onDisconnected);
        this.nusService = await device.gatt.connect();

        console.log('Locate NUS service');
        this.nusService = server.getPrimaryService(bleNusServiceUUID);
        console.log('Found NUS service: ' + this.nusService.uuid);

        console.log('Locate RX characteristic');
        const characteristic1 = this.nusService.getCharacteristic(bleNusCharRXUUID);
        this.rxCharacteristic = characteristic1;
        console.log('Found RX characteristic');

        console.log('Locate TX characteristic');
        const characteristic2 = this.nusService.getCharacteristic(bleNusCharTXUUID);
        this.txCharacteristic = characteristic2;
        console.log('Found TX characteristic');

        console.log('Enable notifications');
        const start = await this.txCharacteristic.startNotifications();

        console.log('Notifications started');

        this.bleConnected = true;
      } catch (error) {
        console.log('' + error);
        if (device && device.gatt.connected) {
          device.gatt.disconnect();
        }
      }
    },

    onDisconnected(){
      console.log(this.bleDevice.id + ' disconnect')
      this.bleConnected = false
    },

    async bleDisconnect(){
      if (!bleDevice) {
        console.log('No Bluetooth Device connected...');
        return;
      }
      console.log('Disconnecting from Bluetooth Device...');
      if (this.bleDevice.gatt.connected) {
        this.bleDevice.gatt.disconnect();
        this.bleConnected = false;
        console.log('Bluetooth Device connected: ' + this.bleDevice.gatt.connected);
      } else {
        console.log('> Bluetooth Device is already disconnected');
      }
    },

    // async selectPort() {
    //   try {
    //     if (!navigator.serial) return false

    //     const port = await navigator.serial.requestPort()
    //     const info = await getUsbInfo(port)
    //     window.location.search = `?vid=${info.vid}&pid=${info.pid}`
    //     console.log(window.search.location)
    //     return true
    //   }
    //   catch(error) {
    //     console.log('' + error);
    //   }
    // },

    async init(/*vid, pid*/bid) {
      // const ports = await navigator.serial.getPorts()
      // const id = vid + ':' + pid
      // this.port = ports.find((port) => vid_pid(port) === id)
      // if (!this.port) {
      //   window.location.search = ``
      //   return;
      // }
      // this.id = id
      // const info = await getUsbInfo(this.port)
      // this.vendor = info.vendor
      // this.product = info.product
      // this.physicallyConnected = true
      
      if(!this.bleDevice) {
        window.location.search = ``
        return;
      } 
      this.id = bid
      this.name = this.bleDevice.name
      console.log(this.name)
      console.log(this.id)

      // // notification for a USB device getting physically connected
      // const onconnect = (e) => {
      //   console.log(id + 'device connected', e)
      //   this.port = e.target
      //   this.physicallyConnected = true
      // }
      // navigator.serial.addEventListener('connect', onconnect);

      // // notification for a USB device getting physically disconnected
      // const ondisconnect = (e) => {
      //   console.log(id + ' disconnect')
      //   this.physicallyConnected = false
      //   this.open = false
      // }
      // navigator.serial.addEventListener('disconnect', ondisconnect);
      // console.log(id + ' initialized')
      
    },

    monitor() {
      this.txCharacteristic.addEventListener('characteristicvaluechanged',
        this.handleNotifications);
    },

    handleNotifications(e){
      console.log('notification');
      let value = e.target.value;
      // Convert raw data bytes to character values and use these to 
      // construct a string.
      let str = "";
      for (let i = 0; i < value.byteLength; i++) {
        str += String.fromCharCode(value.getUint8(i));
      }
      alert(str)
      this.messages.push(str)
    },

    sendNextChunk(a) {
      let chunk = a.slice(0, MTU);
      rxCharacteristic.writeValue(chunk)
        .then(function () {
          if (a.length > MTU) {
            sendNextChunk(a.slice(MTU));
          }
        });
    },

    write(s) {
      if (this.bleDevice && this.bleDevice.gatt.connected) {
        console.log("send: " + s);
        let val_arr = new Uint8Array(s.length)
        for (let i = 0; i < s.length; i++) {
          let val = s[i].charCodeAt(0);
          val_arr[i] = val;
        }
        sendNextChunk(val_arr);
      } else {
        alert('Not connected to a device yet.');
      }
    },

    // async write(data) {
    //   if (this.port?.writable) {
    //     const writer = this.port.writable.getWriter()
    //     await writer.write(encoder.encode(data))
    //     writer.releaseLock()
    //   }
    // },
    // async connect() {
    //   if (!this.port) return
    //   console.log(this.id + ': opening')
    //   console.log('reached1');
    //   try {
    //     await this.port.open(this.options)
    //     this.open = !!this.port?.readable
    //     console.log(this.id + ': opened')
    //     // const { clearToSend, dataCarrierDetect, dataSetReady, ringIndicator} = await this.port.getSignals()
    //     // console.log({ clearToSend, dataCarrierDetect, dataSetReady, ringIndicator})
    //     this.monitor()
      
    //   }
    //   catch (e) {
    //     console.log(e)
    //     window.alert(e.message)
    //   }
    // },
    // async monitor() {
    //   console.log('monitor()')
    //   while (this.open && this.port?.readable) {
    //     this.open = true
    //     const reader = this.port.readable.getReader()
    //     this._reader = reader
    //     try {
    //       while (this.open) {
    //         console.log('reading...')
    //         const { value, done } = await reader.read()
    //         if (done) {
    //           // |reader| has been canceled.
    //           this.open = false
    //           break;
    //         }
    //         const decoded = decoder.decode(value)
    //         // console.log('read complete:', decoded, value, done)
    //         this.messages.push(decoded)
    //       }
    //     } catch (error) {
    //       console.error('reading error', error)
    //     } finally {
    //       reader.releaseLock()
    //     }
    //   }
    // },

    
    // async close() {
    //   if (this._reader) {
    //     await this._reader.cancel()
    //   }
    //   this.port.close()
    // }
  }
})



export { useConnectionStore }
