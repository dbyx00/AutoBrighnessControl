import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

import { smoothSetBrightness } from './brightnessControl.js';

let activePort = null;
let reconnectTimeout = null;

async function findSensorPort() {

    console.log(' BOOT · Buscando sensor...');
    
    const ports = await SerialPort.list();
    
    for (const portInfo of ports) {
        try {
            const testPort = new SerialPort({
                path: portInfo.path,
                baudRate: 9600,
                autoOpen: false,
            });

            await new Promise((resolve, reject) => {
                testPort.open((err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });

            const parser = testPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

            let timeout;

            const cleanup = () => {
                clearTimeout(timeout);
            };

            const onData = (data) => {
                if (data.includes('SENSOR_LUZ_BH1750')) {

                    console.log(` BOOT · Sensor encontrado en ${portInfo.path}`);

                    activePort = testPort;
                    cleanup();

                    // Ya tenemos el puerto abierto: simplemente seguimos leyendo
                    parser.removeListener('data', onData); // Eliminamos el listener temporal

                    // Añadimos nuevo listener para datos reales
                    parser.on('data', (data) => {
                        if (data.includes('SENSOR_LUZ_BH1750')) return;

                        const lux = parseFloat(data);
                        if (!isNaN(lux)) {
                            smoothSetBrightness(lux);
                        } else {
                            console.log(' SENSOR · Dato no válido:', data);
                        }
                    });

                    activePort.on('close', () => {
                        console.log(' SENSOR · Desconectado, buscando de nuevo...');
                        activePort = null;
                        reconnect();
                    });

                    testPort.on('error', (err) => {
                        console.log(' SENSOR · Error:', err.message);
                        testPort.close(); // Triggea el evento 'close'
                    });

                }
            };

            const onError = (err) => {
                cleanup();
                testPort.close();
            };

            parser.on('data', onData);
            testPort.on('error', onError);

            timeout = setTimeout(() => {
                parser.off('data', onData);
                testPort.close();
            }, 3000);

            // Salimos del bucle una vez que encontramos el sensor para evitar múltiples instancias

        } catch (err) {
            // No se pudo abrir puerto, ignoramos
        }
    }

    if (!activePort) {
        reconnect();
    }

}

function reconnect(delay = 3000) {
    if (reconnectTimeout) return;
    reconnectTimeout = setTimeout(() => {
        reconnectTimeout = null;
        if (!activePort) findSensorPort();
    }, delay);
}

// Ejecutar escaneo
findSensorPort();