#include <Wire.h>
#include <BH1750.h>

BH1750 lightMeter;

void setup() {
  Serial.begin(9600);
  Wire.begin();
  lightMeter.begin();
  Serial.println("DBY_SENSOR_BH1750");
}

void loop() {
  float lux = lightMeter.readLightLevel();
  Serial.println(lux);
  delay(2500);
}