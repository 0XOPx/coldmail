export type ImpfMessage={version:"1.0";adressant:string;to:string[];cc:string[];bcc:string[];subject:string;date:string;messageId:string;replyTo?:string;inReplyTo?:string;threadId?:string;contentType:string;body:string;attachments:string[];priority:"low"|"normal"|"high";labels:string[]};

const clean=(v:string)=>v.replace(/[\r\n]/g,"").trim();
const list=(v:string)=>v.split(",").map(clean).filter(Boolean);

export function parseImpf(raw:string):ImpfMessage{
  if(raw.length>1000000) throw new Error("payload_too_large");
  const lines=raw.replace(/\r\n/g,"\n").split("\n");
  if(lines[0]!=="IMPF-Version: 1.0") throw new Error("invalid_version");
  const start=lines.indexOf("--- New Message ---");
  const end=lines.indexOf("--- End of Message ---");
  if(start<1||end<=start) throw new Error("invalid_message");
  const headers=new Map<string,string>();
  for(const line of lines.slice(1,start)){
    const p=line.indexOf(":");
    if(p<1) continue;
    const key=line.slice(0,p).trim().toLowerCase();
    if(headers.has(key)) throw new Error("duplicate_header");
    headers.set(key,clean(line.slice(p+1)));
  }
  for(const key of ["adressant","to","subject","date","message-id","content-type"]) if(!headers.get(key)) throw new Error("missing_header");
  const date=headers.get("date")!;
  if(Number.isNaN(Date.parse(date))) throw new Error("invalid_date");
  const messageId=headers.get("message-id")!;
  if(!/^<[^<>\s]{3,200}>$/.test(messageId)) throw new Error("invalid_message_id");
  const priority=headers.get("priority")||"normal";
  if(!["low","normal","high"].includes(priority)) throw new Error("invalid_priority");
  const body=lines.slice(start+1,end).join("\n").trim();
  if(body.length>500000) throw new Error("body_too_large");
  return {version:"1.0",adressant:headers.get("adressant")!,to:list(headers.get("to")!),cc:list(headers.get("cc")||""),bcc:list(headers.get("bcc")||""),subject:headers.get("subject")!.slice(0,300),date,messageId,replyTo:headers.get("reply-to")||undefined,inReplyTo:headers.get("in-reply-to")||undefined,threadId:headers.get("thread-id")||undefined,contentType:headers.get("content-type")!,body,attachments:list(headers.get("attachments")||""),priority:priority as ImpfMessage["priority"],labels:list(headers.get("labels")||"")};
}

export function encodeImpf(m:ImpfMessage){
  const lines=["IMPF-Version: 1.0","Adressant: "+clean(m.adressant),"To: "+m.to.map(clean).join(", "),"CC: "+m.cc.map(clean).join(", "),"BCC: "+m.bcc.map(clean).join(", "),"Subject: "+clean(m.subject),"Date: "+clean(m.date),"Message-ID: "+clean(m.messageId)];
  if(m.replyTo) lines.push("Reply-To: "+clean(m.replyTo));
  if(m.inReplyTo) lines.push("In-Reply-To: "+clean(m.inReplyTo));
  if(m.threadId) lines.push("Thread-ID: "+clean(m.threadId));
  lines.push("Content-Type: "+clean(m.contentType),"Priority: "+m.priority,"Labels: "+m.labels.map(clean).join(", "),"Attachments: "+m.attachments.map(clean).join(", "),"--- New Message ---",m.body,"--- End of Message ---");
  return lines.join("\n");
}
