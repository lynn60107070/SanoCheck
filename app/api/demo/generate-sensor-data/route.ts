import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * Load 24 hours of hourly sensor data for a bathroom
 * All values are in percentage (0-100%)
 * Fixed deterministic values for consistent data collection
 */
export async function POST(request: Request) {
  try {
    const { bathroomId } = await request.json();

    if (!bathroomId) {
      return NextResponse.json(
        { error: 'bathroomId is required' },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Supabase admin client not available' },
        { status: 500 }
      );
    }

    // Get current time
    const now = new Date();
    
    // Delete existing sensor readings for this bathroom from the past 24 hours to avoid duplicates
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    const { error: deleteError } = await supabaseAdmin
      .from('sensor_readings')
      .delete()
      .eq('bathroom_id', bathroomId)
      .gte('created_at', twentyFourHoursAgo.toISOString());

    if (deleteError) {
      console.error('Error deleting old sensor data:', deleteError);
    }

    // Fixed deterministic data patterns for each hour (0-23)
    // These simulate realistic sensor readings from hardware devices
    // Format: [Hour, Gas%, Water%, Humidity%]
    const hourlyData = [
      [0, 12, 85, 45], [1, 15, 82, 48], [2, 18, 80, 52], [3, 20, 78, 55],
      [4, 22, 75, 58], [5, 25, 88, 50], [6, 28, 92, 48], [7, 30, 95, 45],
      [8, 28, 90, 42], [9, 25, 88, 40], [10, 22, 85, 38], [11, 20, 82, 35],
      [12, 18, 80, 32], [13, 15, 78, 30], [14, 12, 75, 28], [15, 10, 72, 30],
      [16, 12, 70, 32], [17, 15, 75, 35], [18, 18, 80, 38], [19, 20, 85, 42],
      [20, 22, 88, 45], [21, 25, 90, 48], [22, 28, 85, 50], [23, 30, 82, 52],
    ];

    // Generate 24 hourly readings going back 24 hours from now
    const readings = [];
    for (let hour = 0; hour < 24; hour++) {
      // Calculate timestamp: go back 23 hours, then 22, then 21... to 0 hours ago
      const hoursAgo = 23 - hour;
      const timestamp = new Date(now.getTime() - (hoursAgo * 60 * 60 * 1000));
      
      // Use the hour of the timestamp to get the data pattern
      const timestampHour = timestamp.getHours();
      const [hourNum, gasValue, waterValue, humidityValue] = hourlyData[timestampHour];

      // Add gas reading
      readings.push({
        bathroom_id: bathroomId,
        sensor_type: 'gas',
        gas_type: 'H2S',
        value: gasValue,
        unit: '%',
        created_at: timestamp.toISOString(),
      });

      // Add water reading
      readings.push({
        bathroom_id: bathroomId,
        sensor_type: 'water',
        value: waterValue,
        unit: '%',
        created_at: timestamp.toISOString(),
      });

      // Add humidity reading
      readings.push({
        bathroom_id: bathroomId,
        sensor_type: 'humidity',
        value: humidityValue,
        unit: '%',
        created_at: timestamp.toISOString(),
      });
    }

    // Insert all readings in batch using Supabase
    const { error: insertError, data } = await supabaseAdmin
      .from('sensor_readings')
      .insert(readings)
      .select();

    if (insertError) {
      console.error('Error inserting sensor data:', insertError);
      return NextResponse.json(
        { error: 'Failed to load sensor data', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Loaded 24 hours of sensor data for bathroom ${bathroomId}`,
      readingsCount: readings.length,
      bathroomId,
    });
  } catch (error) {
    console.error('Error in generate-sensor-data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
