import type { EngineInterface } from 'claude-code'

/**
 * The person's home folder, or undefined when the environment names none. HOME where it is set; Windows sets none and
 * names the folder in USERPROFILE, with backslashes. Every path here is built with `/`, which Windows takes too and the
 * tools the record is read with (jq, sh) take alone, so the folder is handed on with them.
 */
export async function homeOf($: EngineInterface): Promise<string | undefined> {
  const home = (await $.env.get('HOME')) || (await $.env.get('USERPROFILE'))
  return home ? home.replaceAll('\\', '/') : undefined
}
