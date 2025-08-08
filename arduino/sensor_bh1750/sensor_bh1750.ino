#include <Wire.h>
#include <BH1750.h>

BH1750 lightMeter;

void setup() {
  Serial.begin(9600);
  Wire.begin();
  lightMeter.begin();

  delay(1000);
  Serial.println("SENSOR_LUZ_BH1750"); // Firma de identificación
}

void loop() {
  float lux = lightMeter.readLightLevel();
  Serial.println(lux);
  delay(2500);
}