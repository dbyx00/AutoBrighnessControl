import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { delay } from './utils.js';

import { smoothSetBrightness } from './brightnessControl.js';

let activePort = null;
let activeParser = null;
let reconnectTimeout = null;

const SENSOR_VENDOR_ID = '';
const SENSOR_PRODUCT_ID = '';
const SENSOR_SERIAL_NUMBER = '';

async function findSensorPort() {

    console.log(' BOOT · Buscando sensor...');

    const ports = await SerialPort.list();
    const sensorPort = ports.find(p => p.vendorId === SENSOR_VENDOR_ID && p.productId === SENSOR_PRODUCT_ID && p.serialNumber === SENSOR_SERIAL_NUMBER);

    if (sensorPort) {
        openPortAndListen(sensorPort.path);
    } else {
        await delay(2500)
        findSensorPort()
    }

}

async function openPortAndListen(portPath) {

    if (activePort) {
        activePort.close();
        activePort = null;
        activeParser = null;
    }

    const port = new SerialPort({ path: portPath, baudRate: 9600, autoOpen: false });

    const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

    port.open((err) => {
        if (err) {
            console.error(' BOOT · Error abriendo el puerto:', err.message);
            scheduleReconnect();
            return;
        }
        console.log(' BOOT · Conexión establecida:', portPath);
    });

    parser.on('data', (line) => {
        const lux = parseFloat(line);
        if (!isNaN(lux)) {
            smoothSetBrightness(lux);
        } else {
            console.log(' SENSOR · Dato no reconocido:', line);
        }
    });

    port.on('close', () => {
        console.warn(' BOOT · Dispositivo desconectado, intentando reconectar...');
        closeActivePort();
        scheduleReconnect();
    });

    port.on('error', () => {
        closeActivePort();
        scheduleReconnect();
    });

    activePort = port;
    activeParser = parser;

}

function closeActivePort() {
    if (activePort) {
        activePort.close();
        activePort = null;
        activeParser = null;
    }
}

function scheduleReconnect() {
  if (reconnectTimeout) return;
  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    if (!activePort) findSensorPort();
  }, 3000);
}

findSensorPort();