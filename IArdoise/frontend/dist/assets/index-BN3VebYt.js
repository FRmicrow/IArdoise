(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const o of document.querySelectorAll('link[rel="modulepreload"]'))s(o);new MutationObserver(o=>{for(const i of o)if(i.type==="childList")for(const h of i.addedNodes)h.tagName==="LINK"&&h.rel==="modulepreload"&&s(h)}).observe(document,{childList:!0,subtree:!0});function e(o){const i={};return o.integrity&&(i.integrity=o.integrity),o.referrerPolicy&&(i.referrerPolicy=o.referrerPolicy),o.crossOrigin==="use-credentials"?i.credentials="include":o.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function s(o){if(o.ep)return;o.ep=!0;const i=e(o);fetch(o.href,i)}})();class N{constructor(){this.listeners=new Map}on(t,e){const s=this.listeners.get(t)??new Set;return s.add(e),this.listeners.set(t,s),()=>{s.delete(e)}}emit(t,e){const s=this.listeners.get(t);if(s)for(const o of s)o(e)}}class q{constructor(t){this.authPayload=t,this.socket=null,this.reconnectAttempts=0,this.manuallyClosed=!1,this.events=new N}connect(){this.manuallyClosed=!1;const t=window.location.protocol==="https:"?"wss:":"ws:";this.socket=new WebSocket(`${t}//${window.location.host}/ws`),this.socket.addEventListener("open",()=>{this.reconnectAttempts=0,this.send("AUTH",this.authPayload)}),this.socket.addEventListener("message",e=>{const s=JSON.parse(e.data);this.events.emit(s.type,s.payload)}),this.socket.addEventListener("close",()=>{if(this.manuallyClosed)return;const e=Math.min(1e3*2**this.reconnectAttempts,1e4);this.reconnectAttempts+=1,window.setTimeout(()=>this.connect(),e)})}close(){var t;this.manuallyClosed=!0,(t=this.socket)==null||t.close(),this.socket=null}on(t,e){return this.events.on(t,e)}send(t,e){var s;((s=this.socket)==null?void 0:s.readyState)===WebSocket.OPEN&&this.socket.send(JSON.stringify({type:t,payload:e}))}}class j{constructor(){this.strokes=[]}addStroke(t){this.strokes.push(t)}clear(){this.strokes=[]}getAll(){return this.strokes}}class O{constructor(t,e){this.canvas=t,this.container=e,this.strokeStore=new j,this.activeStroke=null;const s=t.getContext("2d");if(!s)throw new Error("2D canvas context unavailable");this.context=s,this.context.lineCap="round",this.context.lineJoin="round",this.resizeObserver=new ResizeObserver(()=>{this.resize()}),this.canvas.style.touchAction="none",this.bindEvents(),this.resizeObserver.observe(this.container),this.resize()}clear(){this.strokeStore.clear(),this.fillBackground()}destroy(){this.resizeObserver.disconnect()}bindEvents(){this.canvas.addEventListener("pointerdown",e=>{const s=this.getPoint(e);this.activeStroke={points:[s],colour:"#ffffff",width:4},this.canvas.setPointerCapture(e.pointerId),this.drawStrokeSegment(this.activeStroke)}),this.canvas.addEventListener("pointermove",e=>{this.activeStroke&&(this.activeStroke.points.push(this.getPoint(e)),this.drawStrokeSegment(this.activeStroke))});const t=()=>{this.activeStroke&&(this.strokeStore.addStroke(this.activeStroke),this.activeStroke=null)};this.canvas.addEventListener("pointerup",t),this.canvas.addEventListener("pointercancel",t)}resize(){const t=Math.max(this.container.clientWidth,1),e=Math.max(this.container.clientHeight,1);this.canvas.width=t,this.canvas.height=e,this.fillBackground(),this.redraw()}fillBackground(){this.context.fillStyle="#000000",this.context.fillRect(0,0,this.canvas.width,this.canvas.height)}redraw(){for(const t of this.strokeStore.getAll())this.drawFullStroke(t)}drawFullStroke(t){if(t.points.length!==0){this.context.strokeStyle=t.colour,this.context.lineWidth=t.width,this.context.beginPath(),this.context.moveTo(t.points[0].x,t.points[0].y);for(const e of t.points.slice(1))this.context.lineTo(e.x,e.y);t.points.length===1&&this.context.lineTo(t.points[0].x,t.points[0].y),this.context.stroke()}}drawStrokeSegment(t){const e=t.points,s=e[e.length-2]??e[0],o=e[e.length-1];this.context.strokeStyle=t.colour,this.context.lineWidth=t.width,this.context.beginPath(),this.context.moveTo(s.x,s.y),this.context.lineTo(o.x,o.y),this.context.stroke()}getPoint(t){const e=this.canvas.getBoundingClientRect();return{x:t.clientX-e.left,y:t.clientY-e.top}}}function R(n){const t=sessionStorage.getItem("token"),e=sessionStorage.getItem("hostSessionId");if(!t||!e){window.location.hash="#/login";return}n.innerHTML=`
    <main style="padding: 24px; display: grid; gap: 16px; max-width: 720px; margin: 0 auto;">
      <h1>Host Game</h1>
      <div style="display: flex; gap: 8px; border-bottom: 1px solid #ccc; padding-bottom: 8px;">
        <button id="tab-controls" type="button" data-tab="controls" style="font-weight: bold;">Controls</button>
        <button id="tab-canvas" type="button" data-tab="canvas">My Canvas</button>
      </div>
      <div id="panel-controls">
        <label style="display: grid; gap: 8px; margin-bottom: 12px;">
          <span>Prompt</span>
          <input id="prompt-input" type="text" maxlength="200" placeholder="Type the next prompt" />
        </label>
        <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 12px;">
          <button id="next-question" type="button">Next Question</button>
          <button id="end-game" type="button">End Game</button>
        </div>
        <ul id="player-list" style="display: grid; gap: 8px; list-style: none; padding: 0;"></ul>
      </div>
      <div id="panel-canvas" style="display: none; position: relative; height: 60vh;">
        <canvas id="host-canvas" style="display: block; width: 100%; height: 100%;"></canvas>
      </div>
      <p id="status" role="status"></p>
    </main>
  `;const s=n.querySelector("#player-list"),o=n.querySelector("#prompt-input"),i=n.querySelector("#next-question"),h=n.querySelector("#end-game"),g=n.querySelector("#status"),f=n.querySelector("#tab-controls"),d=n.querySelector("#tab-canvas"),m=n.querySelector("#panel-controls"),v=n.querySelector("#panel-canvas"),k=n.querySelector("#host-canvas");if(!s||!o||!i||!h||!g||!f||!d||!m||!v||!k)return;const u=new q({role:"host",token:t,sessionId:e});u.connect();let b=null;const I=a=>{a==="controls"?(m.style.display="block",v.style.display="none",f.style.fontWeight="bold",d.style.fontWeight=""):(m.style.display="none",v.style.display="block",f.style.fontWeight="",d.style.fontWeight="bold",b||(b=new O(k,v)))};f.addEventListener("click",()=>I("controls")),d.addEventListener("click",()=>I("canvas"));let l;const T=a=>{s.innerHTML="";for(const y of a){const p=document.createElement("li");p.dataset.playerId=y.playerId,p.style.display="grid",p.style.gridTemplateColumns="1fr auto auto auto",p.style.gap="8px",p.innerHTML=`
        <span>${y.name}</span>
        <span data-role="score">${y.score}</span>
        <button type="button" data-action="decrement">−</button>
        <button type="button" data-action="increment">+</button>
      `,s.appendChild(p)}},C=(a,y)=>{const p=s.querySelector(`[data-player-id="${a}"]`),w=p==null?void 0:p.querySelector('[data-role="score"]');w&&(w.textContent=String(y))};u.on("SESSION_STATE",a=>{o.value=a.currentPrompt,T(a.players.map(y=>({playerId:y.playerId,name:y.name,score:y.score})))}),u.on("PLAYER_JOINED",a=>{const y=Array.from(s.querySelectorAll("li")).map(p=>{var w,E;return{playerId:p.dataset.playerId??"",name:((w=p.querySelector("span"))==null?void 0:w.textContent)??"",score:Number(((E=p.querySelector('[data-role="score"]'))==null?void 0:E.textContent)??"0")}});y.push({playerId:a.playerId,name:a.name,score:a.score}),T(y)}),u.on("SCORE_UPDATED",a=>{C(a.playerId,a.newScore)}),u.on("PROMPT_UPDATED",a=>{o.value=a.text}),u.on("QUESTION_ADVANCED",()=>{o.value="",b==null||b.clear()}),u.on("ERROR",a=>{window.dispatchEvent(new CustomEvent("ws-error",{detail:a}))}),u.on("GAME_ENDED",a=>{sessionStorage.setItem("scoreboard",JSON.stringify(a.scoreboard)),window.location.hash="#/scoreboard"}),s.addEventListener("click",a=>{const y=a.target,p=y.dataset.action;if(!p)return;const w=y.closest("li"),E=w==null?void 0:w.dataset.playerId;E&&u.send("UPDATE_SCORE",{sessionId:e,playerId:E,delta:p==="increment"?1:-1})}),o.addEventListener("input",()=>{window.clearTimeout(l),l=window.setTimeout(()=>{u.send("SET_PROMPT",{sessionId:e,text:o.value})},300)}),i.addEventListener("click",()=>{u.send("NEXT_QUESTION",{sessionId:e})}),h.addEventListener("click",()=>{window.confirm("End the game?")&&(u.send("END_GAME",{sessionId:e}),g.textContent="Ending game…")}),window.addEventListener("hashchange",()=>{u.close(),b==null||b.destroy()},{once:!0})}function L(n){const t=sessionStorage.getItem("playerId"),e=sessionStorage.getItem("playerSessionId");if(!t||!e){window.location.hash="#/login";return}n.innerHTML=`
    <main style="height: 100vh; display: grid; grid-template-rows: auto auto 1fr; gap: 12px; padding: 16px; position: relative;">
      <div id="waiting" style="padding: 12px; background: rgba(255,255,255,0.12);">Waiting for the host to start the game.</div>
      <p id="prompt" style="font-size: 1.125rem; min-height: 1.5em;"></p>
      <div id="canvas-container" style="min-height: 0; width: 100%; height: 100%;">
        <canvas id="drawing-canvas" style="display: block; width: 100%; height: 100%;"></canvas>
      </div>
      <div id="host-disconnected-overlay" style="display: none; position: absolute; inset: 0; background: rgba(0,0,0,0.75); color: #fff; align-items: center; justify-content: center; font-size: 1.125rem; text-align: center; padding: 24px;">
        Host disconnected — waiting for reconnect…
      </div>
    </main>
  `;const s=n.querySelector("#waiting"),o=n.querySelector("#prompt"),i=n.querySelector("#drawing-canvas"),h=n.querySelector("#canvas-container"),g=n.querySelector("#host-disconnected-overlay");if(!s||!o||!i||!h||!g)return;const f=new O(i,h),d=new q({role:"player",playerId:t,sessionId:e});d.connect(),d.on("SESSION_STATE",m=>{o.textContent=m.currentPrompt,s.style.display=m.status==="active"?"none":"block"}),d.on("PROMPT_UPDATED",m=>{o.textContent=m.text}),d.on("QUESTION_ADVANCED",()=>{f.clear(),o.textContent=""}),d.on("GAME_STARTED",m=>{s.style.display="none",o.textContent=m.currentPrompt,window.location.hash!=="#/player/game"&&history.replaceState(null,"","#/player/game")}),d.on("ERROR",m=>{window.dispatchEvent(new CustomEvent("ws-error",{detail:m}))}),d.on("HOST_DISCONNECTED",()=>{g.style.display="flex"}),d.on("AUTH_OK",()=>{g.style.display="none"}),d.on("GAME_ENDED",m=>{sessionStorage.setItem("scoreboard",JSON.stringify(m.scoreboard)),window.location.hash="#/scoreboard"}),window.addEventListener("hashchange",()=>{f.destroy(),d.close()},{once:!0})}function _(n){const t=window.location.pathname.startsWith("/join/")?window.location.pathname.slice(6):sessionStorage.getItem("hostSessionId")??"";n.innerHTML=`
    <main style="padding: 24px; max-width: 420px; margin: 0 auto; display: grid; gap: 12px;">
      <h1>Join Game</h1>
      <form id="join-form" style="display: grid; gap: 12px;">
        <label>
          Name
          <input id="name" name="name" maxlength="32" required />
        </label>
        <button type="submit">Join</button>
      </form>
      <p id="message" role="status"></p>
    </main>
  `;const e=n.querySelector("#join-form"),s=n.querySelector("#message");!e||!s||e.addEventListener("submit",async o=>{o.preventDefault(),s.textContent="";const i=new FormData(e),h=await fetch(`/api/sessions/${t}/players`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:String(i.get("name")??"")})}),g=await h.json();if(h.status===409){s.textContent="Registration closed";return}if(!h.ok||!g.playerId){s.textContent=g.error??"Unable to join session";return}sessionStorage.setItem("playerId",g.playerId),sessionStorage.setItem("playerName",g.name??""),sessionStorage.setItem("playerSessionId",t),window.location.hash="#/player/game"})}function M(n){sessionStorage.setItem("hostSessionId",n)}function H(){return sessionStorage.getItem("token")}function $(n){const t=H();if(!t){window.location.hash="#/login";return}n.innerHTML=`
    <main style="padding: 24px; display: grid; gap: 16px; max-width: 720px; margin: 0 auto;">
      <h1>Host Lobby</h1>
      <button id="new-game" type="button">New Game</button>
      <button id="start-game" type="button" disabled>Start Game</button>
      <label style="display: grid; gap: 8px;">
        <span>Prompt</span>
        <input id="prompt-input" type="text" maxlength="200" placeholder="Type a prompt for players" />
      </label>
      <p id="current-prompt"></p>
      <p id="join-url"></p>
      <img id="qr-code" alt="Session QR code" style="max-width: 280px; width: 100%; display: none; background: #fff; padding: 12px;" />
      <section>
        <h2>Players</h2>
        <ul id="player-list" style="display: grid; gap: 8px; padding-left: 20px;"></ul>
      </section>
      <div id="join-as-player-section" style="display: none;">
        <button id="join-as-player-btn" type="button">Join as Player</button>
        <div id="join-as-player-form" style="display: none; gap: 8px; align-items: center;">
          <input id="host-player-name" type="text" maxlength="32" placeholder="Your display name" style="flex: 1;" />
          <button id="host-player-submit" type="button">Join</button>
          <button id="host-player-cancel" type="button">Cancel</button>
        </div>
      </div>
      <p id="status" role="status"></p>
    </main>
  `;const e=n.querySelector("#status"),s=n.querySelector("#join-url"),o=n.querySelector("#qr-code"),i=n.querySelector("#player-list"),h=n.querySelector("#new-game"),g=n.querySelector("#start-game"),f=n.querySelector("#prompt-input"),d=n.querySelector("#current-prompt"),m=n.querySelector("#join-as-player-section"),v=n.querySelector("#join-as-player-btn"),k=n.querySelector("#join-as-player-form"),u=n.querySelector("#host-player-name"),b=n.querySelector("#host-player-submit"),I=n.querySelector("#host-player-cancel");if(!e||!s||!o||!i||!h||!g||!f||!d||!m||!v||!k||!u||!b||!I)return;let l=null,T,C=!1;const a=()=>{g.disabled=i.children.length===0},y=(c,r,S="")=>{let x=i.querySelector(`[data-player-id="${c}"]`);x||(x=document.createElement("li"),x.dataset.playerId=c,i.appendChild(x)),x.textContent=`${r}${S}`,a()},p=c=>{var S;const r=i.querySelector(`[data-player-id="${c}"]`);r&&(r.textContent=`${((S=r.textContent)==null?void 0:S.replace(" (disconnected)",""))??""} (disconnected)`)},w=c=>{l==null||l.close(),l=new q({role:"host",token:t,sessionId:c}),l.connect(),m.style.display="block",l.on("SESSION_STATE",r=>{i.innerHTML="",d.textContent=r.currentPrompt,f.value=r.currentPrompt;for(const S of r.players)y(S.playerId,S.name,S.connectionStatus==="disconnected"?" (disconnected)":"");a()}),l.on("PLAYER_JOINED",r=>{y(r.playerId,r.name)}),l.on("PLAYER_DISCONNECTED",r=>{p(r.playerId)}),l.on("PLAYER_RECONNECTED",r=>{var x;const S=i.querySelector(`[data-player-id="${r.playerId}"]`);S&&(S.textContent=((x=S.textContent)==null?void 0:x.replace(" (disconnected)",""))??"")}),l.on("PROMPT_UPDATED",r=>{d.textContent=r.text,f.value=r.text}),l.on("GAME_STARTED",()=>{window.location.hash="#/host/game"}),l.on("GAME_ENDED",r=>{sessionStorage.setItem("scoreboard",JSON.stringify(r.scoreboard)),window.location.hash="#/scoreboard"})};h.addEventListener("click",async()=>{e.textContent="Creating session…";const c=await fetch("/api/sessions",{method:"POST",headers:{Authorization:`Bearer ${t}`}});if(!c.ok){const P=await c.json();e.textContent=P.error??"Unable to create session";return}const{sessionId:r,joinUrl:S}=await c.json();M(r),s.textContent=S,e.textContent="Session created";const x=await fetch(`/api/sessions/${r}/qr`,{headers:{Authorization:`Bearer ${t}`}});if(x.ok){const P=await x.json();o.src=P.dataUrl,o.style.display="block"}w(r)}),g.addEventListener("click",()=>{const c=sessionStorage.getItem("hostSessionId");!l||!c||g.disabled||l.send("START_GAME",{sessionId:c})}),f.addEventListener("input",()=>{const c=sessionStorage.getItem("hostSessionId");!l||!c||(d.textContent=f.value,window.clearTimeout(T),T=window.setTimeout(()=>{l==null||l.send("SET_PROMPT",{sessionId:c,text:f.value})},300))}),v.addEventListener("click",()=>{v.style.display="none",k.style.display="flex",u.focus()}),I.addEventListener("click",()=>{k.style.display="none",v.style.display=C?"none":"inline-block",u.value=""});const E=()=>{const c=sessionStorage.getItem("hostSessionId"),r=u.value.trim();!l||!c||!r||(l.send("HOST_JOIN_AS_PLAYER",{sessionId:c,name:r}),C=!0,k.style.display="none",v.style.display="none",u.value="")};b.addEventListener("click",E),u.addEventListener("keydown",c=>{c.key==="Enter"&&E()})}function J(n){n.innerHTML=`
    <main style="padding: 24px; max-width: 420px; margin: 0 auto; display: grid; gap: 12px;">
      <h1>Host Login</h1>
      <form id="login-form" style="display: grid; gap: 12px;">
        <label>
          Username
          <input id="username" name="username" required />
        </label>
        <label>
          Password
          <input id="password" name="password" type="password" required />
        </label>
        <button type="submit">Log in</button>
      </form>
      <p id="error" role="alert"></p>
    </main>
  `;const t=n.querySelector("#login-form"),e=n.querySelector("#error");!t||!e||t.addEventListener("submit",async s=>{s.preventDefault(),e.textContent="";const o=new FormData(t),i=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:String(o.get("username")??""),password:String(o.get("password")??"")})});if(i.status===401){e.textContent="Invalid credentials";return}const h=await i.json();sessionStorage.setItem("token",h.token),window.location.hash="#/host/lobby"})}function G(n){const t=sessionStorage.getItem("scoreboard"),s=(t?JSON.parse(t):[]).map((o,i)=>`
      <tr>
        <td>${i+1}</td>
        <td>${o.name}</td>
        <td>${o.score}</td>
      </tr>
    `).join("");n.innerHTML=`
    <main style="padding: 24px; max-width: 720px; margin: 0 auto; display: grid; gap: 16px;">
      <h1>Final Scoreboard</h1>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="text-align: left; padding: 8px;">Rank</th>
            <th style="text-align: left; padding: 8px;">Player</th>
            <th style="text-align: left; padding: 8px;">Score</th>
          </tr>
        </thead>
        <tbody>${s}</tbody>
      </table>
    </main>
  `}(function(){const t=document.createElement("div");t.id="global-error-toast",t.setAttribute("role","alert"),t.style.cssText=["display:none","position:fixed","bottom:24px","left:50%","transform:translateX(-50%)","background:#c00","color:#fff","padding:10px 20px","border-radius:6px","font-size:0.95rem","z-index:9999","max-width:90vw","text-align:center","cursor:pointer"].join(";"),t.title="Click to dismiss",document.body.appendChild(t);let e;function s(o){t.textContent=o,t.style.display="block",clearTimeout(e),e=setTimeout(()=>{t.style.display="none"},5e3)}t.addEventListener("click",()=>{t.style.display="none"}),window.addEventListener("ws-error",o=>{const i=o.detail;s((i==null?void 0:i.message)??"An unexpected error occurred")})})();function U(){return!!sessionStorage.getItem("token")}const A={"#/login":J,"#/host/lobby":$,"#/host/game":R,"#/player/game":L,"#/player/wait":L,"#/scoreboard":G};function W(){return window.location.pathname.startsWith("/join/")?"#/join":window.location.hash||"#/login"}function D(){const n=document.querySelector("#app");if(!n)return;const t=W();if(t==="#/join"){_(n);return}if(t.startsWith("#/host/")&&!U()){window.location.hash="#/login";return}(A[t]??A["#/login"])(n)}window.addEventListener("hashchange",D);document.addEventListener("DOMContentLoaded",D);
