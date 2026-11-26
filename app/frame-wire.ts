// Only the waiting MCP invocation holds the private decryption key.
export type SealedFrame = {key:string;iv:string;cipher:string};
function bytes64(bytes:Uint8Array) {
  let str='';
  for(const byte of bytes) str+=String.fromCharCode(byte);
  return btoa(str);
}
function un64(s:string) {return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
export async function frameKeys() {
  return crypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['encrypt','decrypt']);
}
export async function sealFrame(pub:JsonWebKey,jpeg:string) {
  const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt']);
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const rsa=await crypto.subtle.importKey('jwk',pub,{name:'RSA-OAEP',hash:'SHA-256'},false,['encrypt']);
  const wrapped=await crypto.subtle.encrypt('RSA-OAEP',rsa,await crypto.subtle.exportKey('raw',key));
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,un64(jpeg));
  return {key:bytes64(new Uint8Array(wrapped)),iv:bytes64(iv),cipher:bytes64(new Uint8Array(cipher))};
}
export async function openFrame(priv:CryptoKey,sealed:SealedFrame) {
  const raw=await crypto.subtle.decrypt('RSA-OAEP',priv,un64(sealed.key));
  const key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt']);
  const plain=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(sealed.iv)},key,un64(sealed.cipher)));
  if(plain.length<4 || plain[0]!==255 || plain[1]!==216 || plain.at(-2)!==255 || plain.at(-1)!==217) throw Error('Invalid JPEG');
  return {type:'image',mimeType:'image/jpeg',data:bytes64(plain)};
}
