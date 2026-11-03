const sessionState={user:null,csrf:"",active:false,suppressSync:false};
const writeQueues=new Map();
const serverSetupHelp="StudyTrack could not reach its account API. Start this project with `python server.py` (or set that as the Render start command) and open the same web service URL so the app and API share one origin.";
globalThis.StudyTrackAuth=sessionState;

export function currentUser(){return sessionState.user;}
export function authActive(){return sessionState.active;}
export function setSession(payload){sessionState.user=payload?.user||null;sessionState.csrf=payload?.csrf||"";sessionState.active=Boolean(sessionState.user);}
export function clearSession(){sessionState.user=null;sessionState.csrf="";sessionState.active=false;sessionState.suppressSync=false;}

export async function apiRequest(path,{method="GET",body,authWrite=false}={}){
  const headers={"Accept":"application/json"};
  if(body!==undefined)headers["Content-Type"]="application/json";
  if(authWrite&&sessionState.csrf)headers["X-CSRF-Token"]=sessionState.csrf;
  let response;
  try{response=await fetch(path,{method,headers,credentials:"same-origin",body:body===undefined?undefined:JSON.stringify(body)});}
  catch{throw new Error(serverSetupHelp);}
  let payload={};try{payload=await response.json();}catch{}
  if(!response.ok){if([404,405,501].includes(response.status))throw new Error(serverSetupHelp);throw new Error(payload.error||`Request failed (${response.status}).`);}
  if(path.startsWith("/api/")&&(!payload||typeof payload!=="object"||Array.isArray(payload)))throw new Error(serverSetupHelp);
  return payload;
}

export async function restoreSession(){const payload=await apiRequest("/api/session");if(!Object.hasOwn(payload,"user"))throw new Error(serverSetupHelp);if(payload.user)setSession(payload);else clearSession();return payload;}
export async function authenticate(mode,form){const payload=await apiRequest(`/api/${mode}`,{method:"POST",body:form});if(!payload.user||!payload.csrf)throw new Error(serverSetupHelp);setSession(payload);return payload;}
export async function logout(){if(sessionState.active)await apiRequest("/api/logout",{method:"POST",body:{},authWrite:true});clearSession();}
export async function getRemoteData(){return (await apiRequest("/api/data")).data||{};}
export async function uploadData(data){await apiRequest("/api/data",{method:"PUT",body:{data},authWrite:true});}
export async function updateAccount(name){const payload=await apiRequest("/api/account",{method:"PATCH",body:{name},authWrite:true});sessionState.user=payload.user||sessionState.user;}
export async function deleteRemoteData(){await apiRequest("/api/data",{method:"DELETE",authWrite:true});}

sessionState.saveData=(name,value)=>{
  if(!sessionState.active||sessionState.suppressSync)return Promise.resolve();
  const previous=writeQueues.get(name)||Promise.resolve();
  const next=previous.catch(()=>{}).then(()=>apiRequest("/api/data",{method:"PUT",body:{data:{[name]:value}},authWrite:true}));
  writeQueues.set(name,next);
  next.then(()=>window.dispatchEvent(new CustomEvent("studytrack:sync-status",{detail:{ok:true}}))).catch(()=>window.dispatchEvent(new CustomEvent("studytrack:sync-status",{detail:{ok:false}})));
  return next;
};

export function classesApi(){return apiRequest("/api/classes");}
export function studentProfile(profileId){return apiRequest(`/api/profiles/${encodeURIComponent(profileId)}`);}
export function peopleLookup(email){return apiRequest(`/api/people/lookup?email=${encodeURIComponent(email)}`);}
export function directMessages(peerId=""){return apiRequest(`/api/messages${peerId?`?with=${encodeURIComponent(peerId)}`:""}`);}
export function sendDirectMessage(recipientId,body){return apiRequest("/api/messages",{method:"POST",body:{recipient_id:recipientId,body},authWrite:true});}
export function adminOverview(){return apiRequest("/api/admin/overview");}
export function manageAccount(userId,changes){return apiRequest(`/api/admin/users/${encodeURIComponent(userId)}`,{method:"PATCH",body:changes,authWrite:true});}
export function classQuizzes(classId){return apiRequest(`/api/classes/${encodeURIComponent(classId)}/quizzes`);}
export function getQuiz(quizId){return apiRequest(`/api/quizzes/${encodeURIComponent(quizId)}`);}
export function createQuiz(classId,payload){return apiRequest(`/api/classes/${encodeURIComponent(classId)}/quizzes`,{method:"POST",body:payload,authWrite:true});}
export function submitQuiz(quizId,answers){return apiRequest(`/api/quizzes/${encodeURIComponent(quizId)}/attempts`,{method:"POST",body:{answers},authWrite:true});}
export function quizAttempts(quizId){return apiRequest(`/api/quizzes/${encodeURIComponent(quizId)}/attempts`);}
export function createClass(name){return apiRequest("/api/classes",{method:"POST",body:{name},authWrite:true});}
export function joinClass(code){return apiRequest("/api/classes/join",{method:"POST",body:{code},authWrite:true});}
export function classDetail(classId){return apiRequest(`/api/classes/${encodeURIComponent(classId)}`);}
export function createAssignment(classId,payload){return apiRequest(`/api/classes/${encodeURIComponent(classId)}/assignments`,{method:"POST",body:payload,authWrite:true});}
export function submitAssignment(classId,payload){return apiRequest(`/api/classes/${encodeURIComponent(classId)}/submissions`,{method:"POST",body:payload,authWrite:true});}
export function gradeSubmission(classId,submissionId,score,feedback=""){return apiRequest(`/api/classes/${encodeURIComponent(classId)}/submissions/${encodeURIComponent(submissionId)}`,{method:"PATCH",body:{score,feedback},authWrite:true});}
export function classMessages(classId,recipientId){return apiRequest(`/api/classes/${encodeURIComponent(classId)}/messages?with=${encodeURIComponent(recipientId)}`);}
export function sendClassMessage(classId,recipientId,body){return apiRequest(`/api/classes/${encodeURIComponent(classId)}/messages`,{method:"POST",body:{recipient_id:recipientId,body},authWrite:true});}
export function submissionFileUrl(submissionId,fileId){return `/api/submissions/${encodeURIComponent(submissionId)}/files/${encodeURIComponent(fileId)}`;}
