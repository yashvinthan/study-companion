import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const cwd = process.cwd();
    const targetPath = join(cwd, 'src', specifier.substring(2)) + '.ts';
    return {
      url: pathToFileURL(targetPath).href,
      shortCircuit: true
    };
  }
  return nextResolve(specifier, context);
}
