import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { delay } from './utils.js';
import { smoothSetBrightness } from './brightnessControl.js';

// Firma de autenticación del hardware
const DEVICE_SIGNATURE = "DBY_SENSOR_BH1750";

let activePort = null;
let reconnectTimeout = null;

export async function searchPorts(signature, timeout = 2000) {
  const ports = await SerialPort.list();

  for (const portInfo of ports) {
    const portConnection = new SerialPort({ path: portInfo.path, baudRate: 9600, autoOpen: false });
    const parser = portConnection.pipe(new ReadlineParser({ delimiter: '\r\n' }));

    const found = await new Promise((resolve) => {
      let timer;

      const cleanup = () => {
        clearTimeout(timer);
        parser.removeAllListeners('data');
        if (portConnection.isOpen) portConnection.close(() => {});
      };

      portConnection.open((err) => {
        if (err) return resolve(false);

        console.info(` BOOT · Buscando autenticación en ${portInfo.path}`);

        parser.once('data', (line) => {
          const match = line.trim() === signature;
          clearTimeout(timer);
          parser.removeAllListeners('data');

          if (match) {
            // Puerto correcto: no cerramos la conexión
            resolve(true);
          } else {
            // Firma incorrecta: cerramos el puerto
            if (portConnection.isOpen) portConnection.close(() => resolve(false));
            else resolve(false);
          }
        });

        // Timeout: puerto no responde
        timer = setTimeout(() => {
          if (portConnection.isOpen) portConnection.close(() => resolve(false));
          else resolve(false);
        }, timeout);
      });
    });

    if (found) {
      console.log(` BOOT · Conexión establecida en ${portInfo.path}`);
      return { port: portConnection, portParser: parser };
    }
  }

  return { port: null, portParser: null };
}

async function initConnectionHandler(port, parser) {

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

}

function closeActivePort() {
    if (activePort) {
        activePort.close();
        activePort = null;
    }
}

function scheduleReconnect() {
  if (reconnectTimeout) return;
  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    if (!activePort) findSensorPort();
  }, 3000);
}

export async function findSensorPort() {

    console.log(' BOOT · Buscando sensor...');

    const { port, portParser } = await searchPorts(DEVICE_SIGNATURE);

    if (port) {
        initConnectionHandler(port, portParser);
    } else {
        await delay(2500);
        findSensorPort();
    }
}