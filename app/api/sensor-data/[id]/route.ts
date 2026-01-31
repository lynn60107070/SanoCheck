import { NextResponse } from 'next/server';
import { getSensorReadingsByBathroom, getSensorReadingsByBathroomForDate } from '@/lib/db';
import { SensorReading } from '@/lib/types';

interface GraphDataPoint {
  timestamp: number;
  time: string;
  gas: number | null;
  gasRaw: number | null;
  water: number | null;
  waterRaw: number | null;
  humidity: number | null;
  humidityRaw: number | null;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date'); // YYYY-MM-DD for a specific day

    let recentReadings: SensorReading[];
    let dataSourceLabel: string;

    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      recentReadings = await getSensorReadingsByBathroomForDate(params.id, dateParam);
      dataSourceLabel = `sensor_readings for ${dateParam}`;
      console.log(`[Sensor Data API] Fetching data for bathroom: ${params.id} on date: ${dateParam}`);
    } else {
      const allReadings = await getSensorReadingsByBathroom(params.id);
      const twentyFourHoursAgo = Date.now() - (25 * 60 * 60 * 1000);
      recentReadings = allReadings.filter(r => r.timestamp >= twentyFourHoursAgo);
      dataSourceLabel = 'sensor_readings (last 24h)';
      console.log(`[Sensor Data API] Fetching data for bathroom: ${params.id} (last 24h)`);
      console.log(`[Sensor Data API] Total readings from database: ${allReadings.length}`);
    }

    if (recentReadings.length > 0) {
      console.log(`[Sensor Data API] First reading: ${new Date(recentReadings[recentReadings.length - 1].timestamp).toISOString()}`);
      console.log(`[Sensor Data API] Last reading: ${new Date(recentReadings[0].timestamp).toISOString()}`);
      console.log(`[Sensor Data API] Sample readings by type:`, {
        gas: recentReadings.filter(r => r.sensorType === 'gas').length,
        water: recentReadings.filter(r => r.sensorType === 'water').length,
        humidity: recentReadings.filter(r => r.sensorType === 'humidity').length
      });
    }
    
    // Separate by sensor type
    const gasReadings = recentReadings
      .filter(r => r.sensorType === 'gas')
      .sort((a, b) => a.timestamp - b.timestamp);
    
    const waterReadings = recentReadings
      .filter(r => r.sensorType === 'water')
      .sort((a, b) => a.timestamp - b.timestamp);
    
    const humidityReadings = recentReadings
      .filter(r => r.sensorType === 'humidity')
      .sort((a, b) => a.timestamp - b.timestamp);
    
    // Calculate averages over 24 hours
    const gasAvg = gasReadings.length > 0
      ? gasReadings.reduce((sum, r) => sum + r.value, 0) / gasReadings.length
      : null;
    
    const waterAvg = waterReadings.length > 0
      ? waterReadings.reduce((sum, r) => sum + r.value, 0) / waterReadings.length
      : null;
    
    const humidityAvg = humidityReadings.length > 0
      ? humidityReadings.reduce((sum, r) => sum + r.value, 0) / humidityReadings.length
      : null;
    
    // Prepare data for graph
    // All values are already stored as percentages (0-100%)
    const graphData: GraphDataPoint[] = [];
    const allTimestamps = new Set<number>();
    
    gasReadings.forEach(r => allTimestamps.add(r.timestamp));
    waterReadings.forEach(r => allTimestamps.add(r.timestamp));
    humidityReadings.forEach(r => allTimestamps.add(r.timestamp));
    
    // Group readings by hour (round to nearest hour) to handle slight timestamp differences
    // This ensures readings from the same hour are grouped together
    const readingsByHour = new Map<number, { gas?: SensorReading, water?: SensorReading, humidity?: SensorReading }>();
    
    const addToHourMap = (reading: SensorReading) => {
      // Round timestamp to nearest hour (in milliseconds)
      const hourTimestamp = Math.floor(reading.timestamp / (60 * 60 * 1000)) * (60 * 60 * 1000);
      const hourData = readingsByHour.get(hourTimestamp) || {};
      
      if (reading.sensorType === 'gas') hourData.gas = reading;
      if (reading.sensorType === 'water') hourData.water = reading;
      if (reading.sensorType === 'humidity') hourData.humidity = reading;
      
      readingsByHour.set(hourTimestamp, hourData);
    };
    
    gasReadings.forEach(addToHourMap);
    waterReadings.forEach(addToHourMap);
    humidityReadings.forEach(addToHourMap);
    
    // Create graph data points from grouped readings
    Array.from(readingsByHour.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([hourTimestamp, readings]) => {
        graphData.push({
          timestamp: hourTimestamp,
          time: new Date(hourTimestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          gas: readings.gas ? readings.gas.value : null,
          gasRaw: readings.gas?.value || null,
          water: readings.water ? readings.water.value : null,
          waterRaw: readings.water?.value || null,
          humidity: readings.humidity ? readings.humidity.value : null,
          humidityRaw: readings.humidity?.value || null,
        });
      });
    
    console.log(`[Sensor Data API] Graph data points created: ${graphData.length} (from ${readingsByHour.size} unique hours)`);
    
    const response = {
      bathroomId: params.id,
      readings: {
        gas: gasReadings,
        water: waterReadings,
        humidity: humidityReadings,
      },
      averages: {
        gas: gasAvg,
        water: waterAvg,
        humidity: humidityAvg,
      },
      graphData,
      // Debug info
      debug: {
        totalReadingsFromDB: recentReadings.length,
        readingsInLast24h: recentReadings.length,
        gasReadingsCount: gasReadings.length,
        waterReadingsCount: waterReadings.length,
        humidityReadingsCount: humidityReadings.length,
        graphDataPoints: graphData.length,
        dataSource: dataSourceLabel,
        query: dateParam
          ? `sensor_readings WHERE bathroom_id = '${params.id}' AND created_at BETWEEN '${dateParam}T00:00:00Z' AND '${dateParam}T23:59:59Z'`
          : `sensor_readings WHERE bathroom_id = '${params.id}' (last 24h)`
      }
    };
    
    console.log(`[Sensor Data API] Response for ${params.id}:`, {
      graphDataPoints: graphData.length,
      gasReadings: gasReadings.length,
      waterReadings: waterReadings.length,
      humidityReadings: humidityReadings.length
    });
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching sensor data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sensor data' },
      { status: 500 }
    );
  }
}
