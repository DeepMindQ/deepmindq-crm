import { NextResponse } from 'next/server';

// Check if the jobs module loads correctly
let jobsLoaded = false;
let jobsExports: string[] = [];
let jobsError: string | null = null;

try {
  const mod = await import('@/app/api/g-data/[...slug]/jobs.ts');
  jobsLoaded = true;
  jobsExports = Object.keys(mod);
} catch (err: any) {
  jobsError = err.message;
}

// Check if workflow-engine loads
let engineLoaded = false;
let engineExports: string[] = [];
let engineError: string | null = null;

try {
  const mod = await import('@/lib/workflow-engine');
  engineLoaded = true;
  engineExports = Object.keys(mod);
} catch (err: any) {
  engineError = err.message;
}

// Check if zai-helpers loads
let helpersLoaded = false;
let helpersExports: string[] = [];
let helpersError: string | null = null;

try {
  const mod = await import('@/lib/zai-helpers');
  helpersLoaded = true;
  helpersExports = Object.keys(mod);
} catch (err: any) {
  helpersError = err.message;
}

export async function GET() {
  return NextResponse.json({
    jobs: { loaded: jobsLoaded, exports: jobsExports, error: jobsError },
    workflowEngine: { loaded: engineLoaded, exports: engineExports, error: engineError },
    zaiHelpers: { loaded: helpersLoaded, exports: helpersExports, error: helpersError },
  });
}