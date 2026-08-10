import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { PrismaPackageScoreRepository } from '@/infrastructure/persistence/PrismaPackageScoreRepository';
import { GenerateExplanationUseCase } from '@/application/use-cases/GenerateExplanationUseCase';
import { OpenAIExplanationService } from '@/infrastructure/ai/OpenAIExplanationService';
import { Registry } from '@/domain/types/registry';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

const repository = new PrismaPackageScoreRepository(prisma);
const explanationService = new OpenAIExplanationService();
const generateExplanationUseCase = new GenerateExplanationUseCase(repository, explanationService);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name')?.trim();
    const registryRaw = searchParams.get('registry')?.trim();

    if (!name || !registryRaw || (registryRaw !== 'npm' && registryRaw !== 'pypi')) {
      return NextResponse.json(
        { error: 'invalid_request', message: 'Missing or invalid parameters' },
        { status: 400 }
      );
    }

    const registry = registryRaw as Registry;

    const explanation = await generateExplanationUseCase.execute(name, registry);

    return NextResponse.json({ explanation }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'Score not found') {
        return NextResponse.json(
          { error: 'not_found', message: 'Score not found. Explanation requires an already-persisted score.' },
          { status: 404 }
        );
      }
      if (error.message === 'Invalid package status' || error.message === 'Incomplete score data') {
        return NextResponse.json(
          { error: 'invalid_request', message: 'Cannot generate explanation for a package with insufficient data or unsupported status.' },
          { status: 400 }
        );
      }
    }

    console.error('Explanation API Error:', error);
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to generate AI explanation.' },
      { status: 500 }
    );
  }
}
