#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"   // Used to disable brownout reset on ESP32

#include <WiFi.h>
#include <WebServer.h>
#include <FS.h>
#include <LittleFS.h>
#include <Wire.h>

#include "DHT.h"
#include <LiquidCrystal_I2C.h>

// ADC-only pins on ESP32, safe for analog reads
#define WATER_PIN    35
#define GAS_PIN      34

// DHT22 data pin
#define DHTPIN        4

// Status LEDs
#define LED_GREEN    27   // Normal condition
#define LED_BLUE     26   // Hardware issue / blockage
#define LED_RED      25   // Unsafe condition

#define LCD_ADDRESS 0x27
#define LCD_COLUMNS 16
#define LCD_ROWS    2

#define DHTTYPE DHT22

#define HUMIDITY_HIGH 70
#define WATER_HIGH    60
#define GAS_HIGH      40

// How often sensors are sampled and logged
#define READ_INTERVAL_MS (10UL * 1000UL)

LiquidCrystal_I2C lcd(LCD_ADDRESS, LCD_COLUMNS, LCD_ROWS);
DHT dht(DHTPIN, DHTTYPE);
WebServer server(80);

// Cached values for /live JSON endpoint
float lastHumidity = 0;
float lastWater = 0;
float lastGas = 0;
String lastStatus = "ALRIGHT";
unsigned long lastTimestamp = 0;

// Used to enforce READ_INTERVAL_MS timing
unsigned long lastRead = 0;

const char* ssid = "ESP32_Logger";
const char* password = "12345678";

// Simple rule-based evaluation
String evaluateStatus(float h, float w, float g) {
  if (g >= GAS_HIGH && h >= HUMIDITY_HIGH) return "UNSAFE";
  if (w >= WATER_HIGH) return "BROKEN";
  return "ALRIGHT";
}

void updateLEDs(const String& status) {
  // Clear all LEDs first
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_BLUE, LOW);
  digitalWrite(LED_RED, LOW);

  // Enable exactly one indicator
  if (status == "ALRIGHT") digitalWrite(LED_GREEN, HIGH);
  else if (status == "BROKEN") digitalWrite(LED_BLUE, HIGH);
  else if (status == "UNSAFE") digitalWrite(LED_RED, HIGH);
}

void logData(float h, float w, float g, const String& status) {
  // Append mode so power loss does not wipe previous data
  File file = LittleFS.open("/data.csv", FILE_APPEND);
  if (!file) return;

  // CSV format: timestamp,humidity,water,gas,status
  file.printf("%lu,%d,%d,%d,%s\n",
              millis(),
              (int)h,
              (int)w,
              (int)g,
              status.c_str());
  file.close();
}

void handleRoot() {
  // Plain text landing page
  server.send(200, "text/plain",
    "ESP32 Logger\n"
    "/live     -> JSON realtime data\n"
    "/download -> CSV archive\n");
}

void handleLive() {
  // Manual JSON construction to avoid extra libraries
  String json = "{";
  json += "\"timestamp\":" + String(lastTimestamp) + ",";
  json += "\"humidity\":" + String((int)lastHumidity) + ",";
  json += "\"water\":" + String((int)lastWater) + ",";
  json += "\"gas\":" + String((int)lastGas) + ",";
  json += "\"status\":\"" + lastStatus + "\"";
  json += "}";

  server.send(200, "application/json", json);
}

void handleDownload() {
  // Serve the CSV file as an attachment
  if (!LittleFS.exists("/data.csv")) {
    server.send(404, "text/plain", "No data");
    return;
  }

  File file = LittleFS.open("/data.csv", "r");
  server.sendHeader(
    "Content-Disposition",
    "attachment; filename=sensor_data.csv"
  );
  server.streamFile(file, "text/csv");
  file.close();
}

void setup() {
  // Disable brownout reset (common with LCD + WiFi loads)
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

  Serial.begin(115200);

  // Explicit I2C pin assignment for ESP32
  Wire.begin(21, 22);
  Wire.setClock(100000);

  lcd.init();
  lcd.backlight();

  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_BLUE, OUTPUT);
  pinMode(LED_RED, OUTPUT);

  dht.begin();

  // Mount flash filesystem
  if (!LittleFS.begin(true)) {
    while (true);  // Fatal error, stop execution
  }

  // Create CSV header if file is new
  File file = LittleFS.open("/data.csv", FILE_APPEND);
  if (file.size() == 0)
    file.println("timestamp_ms,humidity,water,gas,status");
  file.close();

  // Start ESP32 as access point
  WiFi.mode(WIFI_AP);
  WiFi.softAP(ssid, password);
  WiFi.softAPConfig(
    IPAddress(192,168,4,1),
    IPAddress(192,168,4,1),
    IPAddress(255,255,255,0)
  );

  // Register HTTP routes
  server.on("/", handleRoot);
  server.on("/live", handleLive);
  server.on("/download", handleDownload);
  server.begin();

  // Initial LCD message
  lcd.setCursor(0,0);
  lcd.print("Offline Logger");
  lcd.setCursor(0,1);
  lcd.print("JSON + CSV");
}

void loop() {
  // Handle any incoming HTTP requests
  server.handleClient();

  // Enforce sampling interval
  unsigned long now = millis();
  if (now - lastRead < READ_INTERVAL_MS) return;
  lastRead = now;

  // Read humidity first (most failure-prone)
  float h = dht.readHumidity();
  if (isnan(h)) return;

  // Convert raw ADC values to percentages
  float w = (analogRead(WATER_PIN) / 4095.0) * 100.0;
  float g = (analogRead(GAS_PIN)   / 4095.0) * 100.0;

  // Update cached values
  lastHumidity = h;
  lastWater = w;
  lastGas = g;
  lastStatus = evaluateStatus(h, w, g);
  lastTimestamp = millis();

  updateLEDs(lastStatus);
  logData(h, w, g, lastStatus);

  // Refresh LCD with compact layout
  lcd.clear();
  lcd.setCursor(0,0);
  lcd.printf("H:%d%% G:%d%%", (int)h, (int)g);
  lcd.setCursor(0,1);
  lcd.printf("W:%d%% %s", (int)w, lastStatus.c_str());
}
