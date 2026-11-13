import {generateKeyPairSync,randomBytes} from 'node:crypto';import {writeFile} from 'node:fs/promises';
/** Generates new local secrets only. Never overwrites an existing config. */
const {publicKey,privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const pub=publicKey.export({format:'jwk'}),priv=privateKey.export({format:'jwk'});
const point=Buffer.concat([Buffer.from([4]),Buffer.from(pub.x,'base64url'),Buffer.from(pub.y,'base64url')]);
const env=[
 '# Never commit this file or share its values publicly.',
 '# Enter values from your own Massive and Upstash accounts locally.',
 'MASSIVE_API_KEY=',
 'UPSTASH_REDIS_REST_URL=',
 'UPSTASH_REDIS_REST_TOKEN=',
 `PAIRING_SECRET=${randomBytes(24).toString('base64url')}`,
 `VAPID_PUBLIC_KEY=${point.toString('base64url')}`,
 `VAPID_PRIVATE_KEY=${priv.d}`,
 '# Supply your own contact email in mailto: format.',
 'VAPID_SUBJECT=',
 ''
].join('\n');
try{await writeFile('.env.local',env,{flag:'wx',mode:0o600});console.log('Created .env.local. Add your own data-service credentials and VAPID contact email. Keep this file private.')}
catch(e){if(e.code==='EEXIST'){console.error('.env.local already exists; no settings were changed.')}else console.error('Could not create local configuration.');process.exitCode=1}
