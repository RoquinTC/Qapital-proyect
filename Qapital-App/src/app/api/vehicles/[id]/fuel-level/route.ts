import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

interface FuelLevelData {
  fuelLevel: number; // percentage 0-100
  currentFuel: number; // in gallons
  estimatedRange: number; // km
  avgKmPerGallon: number;
  lastFullTankDate: string | null;
  lastFullTankKm: number;
  totalConsumed: number; // gallons since last full tank
  anomalyDetected: boolean;
  expectedConsumption: number;
  actualConsumption: number;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    const vehicle = await db.vehicle.findFirst({
      where: { id, userId: session.user.id },
      include: {
        fuelLogs: {
          orderBy: { date: "desc" },
        },
      },
    });

    if (!vehicle) {
      return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 });
    }

    if (!vehicle.tankCapacity || vehicle.tankCapacity <= 0) {
      return NextResponse.json({ 
        error: "Capacidad del tanque no configurada",
        fuelLevel: 0,
        currentFuel: 0,
        estimatedRange: 0,
        avgKmPerGallon: 0,
        lastFullTankDate: null,
        lastFullTankKm: 0,
        totalConsumed: 0,
        anomalyDetected: false,
        expectedConsumption: 0,
        actualConsumption: 0,
      });
    }

    const fuelLogs = vehicle.fuelLogs;
    
    if (fuelLogs.length === 0) {
      return NextResponse.json({
        fuelLevel: 0,
        currentFuel: 0,
        estimatedRange: 0,
        avgKmPerGallon: 0,
        lastFullTankDate: null,
        lastFullTankKm: vehicle.currentKm,
        totalConsumed: 0,
        anomalyDetected: false,
        expectedConsumption: 0,
        actualConsumption: 0,
      });
    }

    // Find the last full tank log
    const lastFullTankLog = fuelLogs.find(log => log.isFullTank);
    
    // Calculate average km per gallon from historical data
    let avgKmPerGallon = 0;
    const fullTankLogs = fuelLogs.filter(log => log.isFullTank).sort((a, b) => a.km - b.km);
    
    if (fullTankLogs.length >= 2) {
      const firstLog = fullTankLogs[0];
      const lastLog = fullTankLogs[fullTankLogs.length - 1];
      const totalKm = lastLog.km - firstLog.km;
      const totalGallons = fullTankLogs.slice(1).reduce((sum, log) => sum + log.gallons, 0);
      
      if (totalGallons > 0 && totalKm > 0) {
        avgKmPerGallon = totalKm / totalGallons;
      }
    }

    // If we don't have enough full tank data, use recent logs
    if (avgKmPerGallon === 0 && fuelLogs.length >= 2) {
      const sortedLogs = [...fuelLogs].sort((a, b) => a.km - b.km);
      const totalKm = sortedLogs[sortedLogs.length - 1].km - sortedLogs[0].km;
      const totalGallons = sortedLogs.slice(1).reduce((sum, log) => sum + log.gallons, 0);
      
      if (totalGallons > 0 && totalKm > 0) {
        avgKmPerGallon = totalKm / totalGallons;
      }
    }

    // Default efficiency if no data (conservative estimate)
    if (avgKmPerGallon === 0) {
      avgKmPerGallon = vehicle.type === 'motorcycle' ? 35 : vehicle.type === 'car' ? 25 : 15;
    }

    // Calculate current fuel level
    let currentFuel = 0;
    let lastFullTankDate: string | null = null;
    let lastFullTankKm = vehicle.currentKm;
    let totalConsumed = 0;

    if (lastFullTankLog) {
      // Start from full tank
      currentFuel = vehicle.tankCapacity;
      lastFullTankDate = lastFullTankLog.date.toISOString();
      lastFullTankKm = lastFullTankLog.km;

      // Get all logs after the last full tank
      const logsAfterFullTank = fuelLogs
        .filter(log => log.date > lastFullTankLog.date && log.id !== lastFullTankLog.id)
        .sort((a, b) => a.km - b.km);

      // Calculate consumption based on distance traveled
      if (logsAfterFullTank.length > 0) {
        const latestKm = logsAfterFullTank[logsAfterFullTank.length - 1].km;
        const kmTraveled = latestKm - lastFullTankLog.km;
        
        if (kmTraveled > 0 && avgKmPerGallon > 0) {
          totalConsumed = kmTraveled / avgKmPerGallon;
          currentFuel = Math.max(0, vehicle.tankCapacity - totalConsumed);
        }

        // Add partial refuels
        const partialRefuels = logsAfterFullTank.filter(log => !log.isFullTank);
        partialRefuels.forEach(log => {
          currentFuel += log.gallons;
        });
      }
    } else {
      // No full tank recorded - estimate from most recent logs
      const sortedLogs = [...fuelLogs].sort((a, b) => a.km - b.km);
      
      if (sortedLogs.length >= 2) {
        const firstLog = sortedLogs[0];
        const lastLog = sortedLogs[sortedLogs.length - 1];
        
        // Estimate based on total fuel added and distance
        const totalAdded = sortedLogs.reduce((sum, log) => sum + log.gallons, 0);
        const kmTraveled = lastLog.km - firstLog.km;
        
        if (kmTraveled > 0 && avgKmPerGallon > 0) {
          const estimatedConsumption = kmTraveled / avgKmPerGallon;
          currentFuel = Math.max(0, totalAdded - estimatedConsumption);
        } else {
          currentFuel = totalAdded;
        }
      }
      
      // Cap at tank capacity
      currentFuel = Math.min(currentFuel, vehicle.tankCapacity);
    }

    // Ensure currentFuel doesn't exceed capacity or go below 0
    currentFuel = Math.max(0, Math.min(currentFuel, vehicle.tankCapacity));

    // Calculate fuel level percentage
    const fuelLevel = (currentFuel / vehicle.tankCapacity) * 100;

    // Calculate estimated range
    const estimatedRange = avgKmPerGallon > 0 ? currentFuel * avgKmPerGallon : 0;

    // Anomaly detection
    let anomalyDetected = false;
    let expectedConsumption = 0;
    let actualConsumption = 0;

    if (lastFullTankLog && fuelLogs.length > 1) {
      const logsAfterFullTank = fuelLogs
        .filter(log => log.date > lastFullTankLog.date && log.id !== lastFullTankLog.id && !log.isFullTank)
        .sort((a, b) => a.km - b.km);

      if (logsAfterFullTank.length > 0) {
        const latestKm = logsAfterFullTank[logsAfterFullTank.length - 1].km;
        const kmSinceFullTank = latestKm - lastFullTankLog.km;
        
        expectedConsumption = kmSinceFullTank / avgKmPerGallon;
        actualConsumption = logsAfterFullTank.reduce((sum, log) => sum + log.gallons, 0);

        // Detect anomaly if actual consumption is 30% higher than expected
        if (expectedConsumption > 0 && actualConsumption > expectedConsumption * 1.3) {
          anomalyDetected = true;
        }
      }
    }

    const result: FuelLevelData = {
      fuelLevel: Math.round(fuelLevel * 100) / 100,
      currentFuel: Math.round(currentFuel * 100) / 100,
      estimatedRange: Math.round(estimatedRange),
      avgKmPerGallon: Math.round(avgKmPerGallon * 100) / 100,
      lastFullTankDate,
      lastFullTankKm,
      totalConsumed: Math.round(totalConsumed * 100) / 100,
      anomalyDetected,
      expectedConsumption: Math.round(expectedConsumption * 100) / 100,
      actualConsumption: Math.round(actualConsumption * 100) / 100,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Get fuel level error:", error);
    return NextResponse.json({ error: "Error al calcular nivel de combustible" }, { status: 500 });
  }
}