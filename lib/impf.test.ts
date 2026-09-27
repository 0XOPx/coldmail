import {describe,expect,it} from "vitest";
import {encodeImpf,parseImpf} from "./impf";
describe("IMPF",()=>{
 it("round trips a message",()=>{
  const m={version:"1.0" as const,adressant:"a@coldmail.com",to:["b@coldmail.com"],cc:[],bcc:[],subject:"Hello",date:"2026-09-27T12:00:00.000Z",messageId:"<abc123@coldmail.com>",contentType:"text/impf",body:"Hello [bold]world[/bold]",attachments:[],priority:"normal" as const,labels:[]};
  expect(parseImpf(encodeImpf(m))).toEqual(m);
 });
 it("rejects an invalid version",()=>expect(()=>parseImpf("IMPF-Version: 2.0")).toThrow("invalid_version"));
});
