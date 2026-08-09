import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { PrismaPackageScoreRepository } from '@/infrastructure/persistence/PrismaPackageScoreRepository';
import { PrismaBenchmarkSnapshotRepository } from '@/infrastructure/persistence/PrismaBenchmarkSnapshotRepository';
import { PackageResolutionService } from '@/infrastructure/registry/PackageResolutionService';
import { SignalCollectionService } from '@/application/services/SignalCollectionService';
import { GetBenchmarkSnapshotUseCase } from '@/application/use-cases/GetBenchmarkSnapshotUseCase';
import { GetPackageScoreUseCase } from '@/application/use-cases/GetPackageScoreUseCase';
import { Registry } from '@/domain/types/registry';

// Create singleton instances to avoid exhausting connections in development,
// and to reuse dependencies across requests.
const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

const repository = new PrismaPackageScoreRepository(prisma);
const benchmarkRepository = new PrismaBenchmarkSnapshotRepository(prisma);
const resolutionService = new PackageResolutionService();
const signalCollectionService = new SignalCollectionService();
const getBenchmarkSnapshotUseCase = new GetBenchmarkSnapshotUseCase(benchmarkRepository);

const getPackageScoreUseCase = new GetPackageScoreUseCase(
  repository,
  resolutionService,
  signalCollectionService,
  getBenchmarkSnapshotUseCase
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name')?.trim();
    const registryRaw = searchParams.get('registry')?.trim();

    if (!name) {
      return NextResponse.json(
        { error: 'invalid_request', message: 'Missing or empty name parameter' },
        { status: 400 }
      );
    }

    if (!registryRaw || (registryRaw !== 'npm' && registryRaw !== 'pypi')) {
      return NextResponse.json(
        { error: 'invalid_request', message: 'Missing or invalid registry parameter' },
        { status: 400 }
      );
    }

    const registry = registryRaw as Registry;

    const result = await getPackageScoreUseCase.execute(name, registry);

    if (result.status === 'unsupported_or_unresolved') {
      return NextResponse.json({
        score: null,
        reason: 'unsupported_or_unresolved'
      }, { status: 200 });
    }

    if (result.status === 'insufficient_data') {
      return NextResponse.json({
        score: null,
        reason: 'insufficient_data',
        methodology_version: result.methodologyVersion,
        provisional: result.isProvisional,
        completeness: {
          health_score: null,
          metrics_available: result.metricsAvailable,
          metrics_total: result.metricsTotal
        },
        metrics: result.metricsBreakdown?.map(m => ({
          metric: m.metric,
          percentile: m.percentile,
          weight: m.weight,
          status: m.percentile !== null ? 'success' : 'unavailable'
        })) || []
      }, { status: 200 });
    }

    return NextResponse.json({
      score: result.healthScore,
      reason: null,
      methodology_version: result.methodologyVersion,
      provisional: result.isProvisional,
      completeness: {
        health_score: result.healthScore,
        metrics_available: result.metricsAvailable,
        metrics_total: result.metricsTotal
      },
      metrics: result.metricsBreakdown?.map(m => ({
        metric: m.metric,
        percentile: m.percentile,
        weight: m.weight,
        status: m.percentile !== null ? 'success' : 'unavailable'
      })) || []
    }, { status: 200 });
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json({
      error: 'internal_error',
      message: 'Unable to calculate package score'
    }, { status: 500 });
  }
}
