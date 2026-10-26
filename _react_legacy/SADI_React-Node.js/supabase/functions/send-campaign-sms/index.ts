import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { handleSendSms } from "../send-sms/index.ts";

Deno.serve(handleSendSms);
