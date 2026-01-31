#include "soc/soc.h"                 // Access to low-level ESP32 system registers
#include "soc/rtc_cntl_reg.h"        // Used here to disable brownout detection
#include <WiFi.h>                    // WiFi stack (ESP32 runs as an AP)
#include <WebServer.h>               // Lightweight HTTP server
#include <FS.h>                      // Filesystem base class
#include <LittleFS.h>                // Flash-based filesystem
#include "DHT.h"                     // DHT22 temperature/humidity sensor
#include <LiquidCrystal_I2C.h>       // I2C LCD driver
#include <Wire.h>                    // I2C bus

// LCD configuration (I2C backpack)
#define LCD_address 0x27
#define LCD_columns 16
#define LCD_rows 2

// Sensor pins
#define WATER_PIN    35
#define GAS_PIN      34
#define DHTPIN        4
#define DHTTYPE DHT22

// Status LEDs
#define LED_GREEN  27   // System OK
#define LED_BLUE   26   // Mechanical / water fault
#define LED_RED    25   // Unsafe conditions

// Sampling interval (milliseconds)
#define READ_INTERVAL_MS (10UL * 1000UL)

// Thresholds (%)
#define HUMIDITY_HIGH 70
#define WATER_HIGH    60
#define GAS_HIGH      40


// LCD over I2C
LiquidCrystal_I2C lcd(LCD_address, LCD_columns, LCD_rows);

// DHT22 sensor instance
DHT dht(DHTPIN, DHTTYPE);

// HTTP server on port 80
WebServer server(80);


// Timestamp of last sensor read
unsigned long lastRead = 0;


// ESP32 runs as an access point
const char* ssid = "ESP32_Logger";
const char* password = "12345678";


// Decide overall system state based on thresholds
String evaluateStatus(float humidity, float water, float gas) {
  // Gas + humidity together indicate unsafe environment
  if (gas >= GAS_HIGH && humidity >= HUMIDITY_HIGH) {
    return "UNSAFE";
  }

  // High water level indicates physical failure
  if (water >= WATER_HIGH) {
    return "BROKEN";
  }

  // Otherwise everything is within limits
  return "ALRIGHT";
}


// Append one row of data to CSV file in flash
void logData(float h, float w, float g, const String& status) {
  File file = LittleFS.open("/data.csv", FILE_APPEND);
  if (!file) return;  // Fail silently if filesystem is unavailable

  file.print(millis());   // Timestamp since boot
  file.print(",");
  file.print((int)h);
  file.print(",");
  file.print((int)w);
  file.print(",");
  file.print((int)g);
  file.print(",");
  file.println(status);

  file.close();
}


// Root endpoint: basic info
void handleRoot() {
  server.send(
    200,
    "text/plain",
    "ESP32 Logger\nDownload data at: /download\n"
  );
}

// CSV download endpoint
void handleDownload() {
  if (!LittleFS.exists("/data.csv")) {
    server.send(404, "text/plain", "No data");
    return;
  }

  File file = LittleFS.open("/data.csv", "r");

  // Force browser to download instead of display
  server.sendHeader(
    "Content-Disposition",
    "attachment; filename=sensor_data.csv"
  );
  server.streamFile(file, "text/csv");
  file.close();

  // Clear log after download
  LittleFS.remove("/data.csv");

  // Recreate file with header row
  File newFile = LittleFS.open("/data.csv", FILE_WRITE);
  newFile.println("timestamp_ms,humidity_pct,water_pct,gas_pct,status");
  newFile.close();
}

// Update LEDs based on current system state
void updateLEDs(const String& status) {
  // Reset all LEDs first
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_BLUE, LOW);
  digitalWrite(LED_RED, LOW);

  // Enable only the active state LED
  if (status == "ALRIGHT") {
    digitalWrite(LED_GREEN, HIGH);
  }
  else if (status == "BROKEN") {
    digitalWrite(LED_BLUE, HIGH);
  }
  else if (status == "UNSAFE") {
    digitalWrite(LED_RED, HIGH);
  }
}

void setup() {
  delay(1000);  // Give power rails time to stabilize

  Serial.begin(115200);

  // Disable brownout detector (prevents resets with noisy supplies)
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

  // ESP32 ADC resolution (0–4095)
  analogReadResolution(12);

  // Initialize sensors and display
  dht.begin();
  lcd.init();
  delay(500);   // LCD needs a moment after init
  lcd.backlight();

  // Configure LED pins
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_BLUE, OUTPUT);
  pinMode(LED_RED, OUTPUT);

  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_BLUE, LOW);
  digitalWrite(LED_RED, LOW);

  // Mount flash filesystem
  if (!LittleFS.begin(true)) {
    while (true) delay(1000);  // Halt if filesystem fails
  }

  // Create CSV file with header if empty
  File file = LittleFS.open("/data.csv", FILE_APPEND);
  if (file.size() == 0) {
    file.println("timestamp_ms,humidity_pct,water_pct,gas_pct,status");
  }
  file.close();

  // Start ESP32 as WiFi access point
  WiFi.mode(WIFI_AP);
  WiFi.softAP(ssid, password);
  WiFi.softAPConfig(
    IPAddress(192,168,4,1),
    IPAddress(192,168,4,1),
    IPAddress(255,255,255,0)
  );

  // Register HTTP routes
  server.on("/", handleRoot);
  server.on("/download", HTTP_GET, handleDownload);
  server.begin();

  // Startup messages
  Serial.println("ESP32 Logger Ready");
  Serial.println("Connect to WiFi: ESP32_Logger");
  Serial.println("Open: http://192.168.4.1/download");

  // LCD splash screen
  lcd.clear();
  lcd.setCursor(0,0);
  lcd.print("Offline Data Logger");
  lcd.setCursor(0,1);
  lcd.print("by SanoCheck");
}

void loop() {
  // Handle incoming HTTP requests
  server.handleClient();

  // Enforce sampling interval
  unsigned long now = millis();
  if (now - lastRead < READ_INTERVAL_MS) return;
  lastRead = now;

  // Read humidity (ignore cycle if sensor glitches)
  float humidity = dht.readHumidity();
  if (isnan(humidity)) return;

  // Read raw ADC values
  float water = analogRead(WATER_PIN);
  float gas   = analogRead(GAS_PIN);

  // Convert ADC readings to percentages
  water = (water / 4095) * 100.0;
  gas   = (gas   / 4095) * 100.0;

  // Determine system state
  String status = evaluateStatus(humidity, water, gas);

  // Update indicators and log data
  updateLEDs(status);
  logData(humidity, water, gas, status);

  // Debug output over serial
  Serial.print("H:");
  Serial.print((int)humidity);
  Serial.print(" W:");
  Serial.print((int)water);
  Serial.print(" G:");
  Serial.print((int)gas);
  Serial.print(" -> ");
  Serial.println(status);

  // Update LCD display
  lcd.clear();

  // Line 0: humidity and gas
  lcd.setCursor(0, 0);
  lcd.print("H:");
  lcd.print((int)humidity);
  lcd.print("% G:");
  lcd.print((int)gas);
  lcd.print("%");

  // Line 1: water level and status
  lcd.setCursor(0, 1);
  lcd.print("W:");
  lcd.print((int)water);
  lcd.print("% ");
  lcd.print(status);
}
