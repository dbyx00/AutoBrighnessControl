import { DisplayManager, VCPFeatureCode } from "@ddc-node/ddc-node";

// Indica que hay una transición de brillo en curso.
let waitForCompleteFlag = false;
let lastBrightessValue = 0;

function luxToBrightness(lux) {
  const maxLux = 50; // lux máximo esperado
  let brightness = Math.round((lux / maxLux) * 90) + 10; // rango de 10% a 100%
  if (brightness > 100) brightness = 100;
  if (brightness < 10) brightness = 10;
  return brightness;
}

async function smoothSetBrightness(lux, stepDelay = 30, stepSize = 1) {

    // Si ya hay una transición en curso, no reajustamos el brillo hasta que finalice.
    if (waitForCompleteFlag) return;

    const targetValue = luxToBrightness(lux);

    // Si el valor actual es igual al valor ya establecido, no iniciamos la transición.
    if (lastBrightessValue == targetValue) return; 

    // Iniciamos la transición al nuevo valor de brillo.
    console.log(` SENSOR  · Luz: ${lux} lux`);
    lastBrightessValue = targetValue;

    const displayManager = new DisplayManager();
    const displays = await displayManager.collect();

    if (displays.length === 0) {
        console.error(" BRILLO  · No se detectaron monitores compatibles DDC/CI.");
        return;
    }

    console.log(` BRILLO  · Iniciando transición suave a: ${targetValue}%`);
    waitForCompleteFlag = true;

    // Obtener brillos actuales de todos los displays
    const currentValues = await Promise.all(
        displays.map(async (display) => {
            try {
                const vcp = await display.getVcpFeature(VCPFeatureCode.ImageAdjustment.Luminance);
                return { display, current: vcp.currentValue };
            } catch {
                return { display, current: targetValue }; // si falla, ponemos target para evitar bucle infinito
            }
        })
    );

    // Calculamos la cantidad máxima de pasos necesarios
    const maxSteps = Math.max(...currentValues.map(({ current }) => Math.abs(targetValue - current))) / stepSize;

    for (let step = 1; step <= maxSteps; step++) {
        await Promise.all(
            currentValues.map(async ({ display, current }) => {
                let direction = targetValue > current ? 1 : -1;
                let newValue = current + direction * step * stepSize;

                // Clamp entre min y max (10 y 100, por ejemplo)
                if (direction === 1 && newValue > targetValue) newValue = targetValue;
                if (direction === -1 && newValue < targetValue) newValue = targetValue;

                try {
                    await display.setVcpFeature(VCPFeatureCode.ImageAdjustment.Luminance, newValue);
                } catch (error) {
                    console.error(` BRILLO  · Error ajustando brillo en monitor index ${display.index}:`, error);
                }
            })
        );

        await sleep(stepDelay);
    }

    console.log(` BRILLO  · Transición completada a: ${targetValue}%`);
    waitForCompleteFlag = false;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export { smoothSetBrightness };