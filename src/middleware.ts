import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ACCESS_COOKIE="ipsp_access_token";
const REFRESH_COOKIE="ipsp_refresh_token";

function client(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!url||!key)return null;return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});}

export async function middleware(req:NextRequest){
  const pathname=req.nextUrl.pathname;
  const isPublic=pathname==="/login"||pathname.startsWith("/_next")||pathname==="/favicon.ico";
  const db=client();
  if(!db)return NextResponse.next();
  const access=req.cookies.get(ACCESS_COOKIE)?.value;
  const refresh=req.cookies.get(REFRESH_COOKIE)?.value;

  if(access&&await accessIsValid(access,db)){
    if(pathname==="/login")return NextResponse.redirect(new URL("/",req.url));
    return NextResponse.next();
  }

  if(refresh){
    const {data,error}=await db.auth.refreshSession({refresh_token:refresh});
    if(!error&&data.session){
      const res=pathname==="/login"?NextResponse.redirect(new URL("/",req.url)):NextResponse.next();
      setSessionCookies(res,data.session.access_token,data.session.refresh_token,data.session.expires_in);
      return res;
    }
  }

  if(isPublic)return NextResponse.next();
  return NextResponse.redirect(new URL("/login",req.url));
}

async function accessIsValid(token:string,db:ReturnType<typeof createClient>){
  const local=await verifyHs256Jwt(token);
  if(local!==null)return local;
  // Compatibilidad si Supabase cambia el algoritmo de firma: validar contra Auth.
  const {data}=await db.auth.getUser(token);
  return !!data.user;
}

/** Verificación local evita una llamada remota en cada Server Action y no acepta cookies falsas. */
async function verifyHs256Jwt(token:string):Promise<boolean|null>{
  const secret=process.env.SUPABASE_JWT_SECRET;if(!secret)return null;
  try{
    const parts=token.split(".");if(parts.length!==3)return false;
    const header=JSON.parse(new TextDecoder().decode(base64UrlBytes(parts[0])));
    if(header.alg!=="HS256")return null;
    const payload=JSON.parse(new TextDecoder().decode(base64UrlBytes(parts[1])));
    if(typeof payload.exp==="number"&&payload.exp<=Math.floor(Date.now()/1000))return false;
    const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
    return await crypto.subtle.verify("HMAC",key,base64UrlBytes(parts[2]),new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  }catch{return false;}
}
function base64UrlBytes(value:string){let b64=value.replace(/-/g,"+").replace(/_/g,"/");while(b64.length%4)b64+="=";const binary=atob(b64);const out=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);return out;}
function setSessionCookies(res:NextResponse,access:string,refresh:string,expires:number){const secure=process.env.NODE_ENV==="production";res.cookies.set(ACCESS_COOKIE,access,{httpOnly:true,secure,sameSite:"lax",path:"/",maxAge:expires});res.cookies.set(REFRESH_COOKIE,refresh,{httpOnly:true,secure,sameSite:"lax",path:"/",maxAge:60*60*24*30});}

export const config={matcher:["/((?!api/|_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]};
