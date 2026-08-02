(() => {
  "use strict";

  // 画面7の手形認証動画、認証完了状態、備品ケースとロボット会話を管理する。
  // 動画を最後まで再生した時点で、認証後の会話ステージを解放する。
  const body=document.body;
  const video=document.querySelector("#palm-video"),terminal=document.querySelector("#palm-terminal"),status=document.querySelector("#scan-status"),message=document.querySelector("#scan-message"),completePanel=document.querySelector("#scan-complete");
  const inventoryLayer=document.querySelector("#inventory-layer"),inventoryList=document.querySelector("#inventory-list"),inventoryDetails=[...document.querySelectorAll(".inventory-detail")],cipherItem=document.querySelector("#cipher-item"),inventoryCount=document.querySelector("#inventory-count"),inventoryBadge=document.querySelector("#inventory-badge"),emptySlot=document.querySelector("#inventory-empty-slot");
  const chatPanel=document.querySelector("#robot-chat"),chatInput=document.querySelector("#chat-input"),chatHistory=document.querySelector("#chat-history");
  const lightbox=document.querySelector("#image-lightbox"),lightboxImage=document.querySelector("#lightbox-image"),lightboxTitle=document.querySelector("#lightbox-title");

  const initialState=window.GameProgress?.getState()||{};
  const savedScreen7=initialState.screen7||{};
  let completed=Boolean(savedScreen7.palmScanCompleted);
  let cipherTableReceived=Boolean(initialState.screen6?.cipherTableReceived);
  let lastFocus=null,replyIndex=0;
  const replies=["なんのことでしょう？","私にはわかりません。","パイロット認証を進めてください。"];

  const lockPage=locked=>body.classList.toggle("modal-open",locked);
  function renderInventory(){const count=cipherTableReceived?"3":"2";cipherItem.hidden=!cipherTableReceived;emptySlot.hidden=cipherTableReceived;inventoryCount.textContent=count;inventoryBadge.textContent=`0${count}`}
  function openInventory(){lastFocus=document.activeElement;inventoryLayer.hidden=false;lockPage(true);inventoryLayer.querySelector("[data-close-inventory]").focus()}
  function closeInventory(){inventoryLayer.hidden=true;inventoryList.hidden=false;inventoryDetails.forEach(detail=>detail.hidden=true);lockPage(false);lastFocus?.focus()}
  document.querySelector("#inventory-open").addEventListener("click",openInventory);
  document.querySelectorAll("[data-close-inventory]").forEach(button=>button.addEventListener("click",closeInventory));
  document.querySelectorAll("[data-open-detail]").forEach(button=>button.addEventListener("click",()=>{inventoryList.hidden=true;const detail=document.querySelector(`#${button.dataset.openDetail}`);detail.hidden=false;detail.querySelector("[data-detail-back]").focus()}));
  document.querySelectorAll("[data-detail-back]").forEach(button=>button.addEventListener("click",()=>{const detail=button.closest(".inventory-detail");detail.hidden=true;inventoryList.hidden=false;document.querySelector(`[data-open-detail="${detail.id}"]`).focus()}));

  function openChat(){lastFocus=document.activeElement;chatPanel.hidden=false;document.querySelector(".robot-launch").hidden=true;requestAnimationFrame(()=>chatInput.focus())}
  function closeChat(){chatPanel.hidden=true;document.querySelector(".robot-launch").hidden=false;lastFocus?.focus()}
  document.querySelectorAll("[data-open-robot]").forEach(button=>button.addEventListener("click",openChat));
  document.querySelector("#robot-chat-close").addEventListener("click",closeChat);
  function appendMessage(role,text){const wrapper=document.createElement("div"),label=document.createElement("span"),bubble=document.createElement("p");wrapper.className=`chat-message chat-message-${role}`;label.textContent=role==="robot"?"ROBO":"YOU";bubble.textContent=text;wrapper.append(label,bubble);chatHistory.append(wrapper);chatHistory.scrollTop=chatHistory.scrollHeight;return wrapper}
  function isCipherRequest(value){const normalized=value.normalize("NFKC").replace(/[\s　。、！？!?「」『』]/g,"");const hiragana=[...normalized].map(char=>{const code=char.charCodeAt(0);return code>=0x30a1&&code<=0x30f6?String.fromCharCode(code-0x60):char}).join("");return hiragana.includes("暗号表")||hiragana.includes("暗号票")||hiragana.includes("あんごうひょう")}
  function offerCipherTable(){const reply=appendMessage("robot",cipherTableReceived?"暗号表は備品ケースに入っています。":"暗号表ですか？ こちらをどうぞ");if(cipherTableReceived)return;const button=document.createElement("button");button.type="button";button.className="chat-reward-action";button.textContent="暗号表を受け取る";button.addEventListener("click",()=>{cipherTableReceived=true;window.GameProgress?.updateScreen6({cipherTableReceived:true});renderInventory();button.remove();appendMessage("robot","暗号表が備品ケースに入りました")},{once:true});reply.append(button);chatHistory.scrollTop=chatHistory.scrollHeight}
  document.querySelector("#chat-form").addEventListener("submit",event=>{event.preventDefault();const value=chatInput.value.trim();if(!value)return;appendMessage("user",value);chatInput.value="";window.GameProgress.withRobotTyping(()=>{if(window.GameProgress?.respondToPostScanDiscovery(value,appendMessage))return;if(window.GameProgress?.respondToRobotKeyword(value,appendMessage)){cipherTableReceived=Boolean(window.GameProgress.getState().screen6.cipherTableReceived);renderInventory();return}window.GameProgress?.respondToRobotSmallTalk(value,appendMessage)})});

  function openLightbox(button){lastFocus=button;lightboxImage.src=button.dataset.lightboxSrc;lightboxImage.alt=button.dataset.lightboxLabel;lightbox.hidden=false;window.LightboxZoom?.setActive(true);lockPage(true);lightbox.querySelector("[data-close-lightbox]").focus()}
  function closeLightbox(){lightbox.hidden=true;lightboxImage.src="";window.LightboxZoom?.setActive(false);lockPage(false);lastFocus?.focus()}
  document.querySelectorAll("[data-lightbox-src]").forEach(button=>button.addEventListener("click",()=>openLightbox(button)));
  document.querySelectorAll("[data-close-lightbox]").forEach(button=>button.addEventListener("click",closeLightbox));

  // 動画終了と保存状態の復元の両方から呼ばれるため、何度実行しても同じ完了表示にする。
  function showComplete({scroll=false}={}){completed=true;const currentChatStage=window.GameProgress?.getState().screen7.chatStage||"locked";const nextChatStage=currentChatStage==="locked"?"discovering":currentChatStage;terminal.classList.remove("is-scanning");terminal.classList.add("is-complete");status.textContent="SCAN COMPLETE";message.textContent="パイロット認証を確認しました。";completePanel.hidden=false;window.GameProgress?.updateScreen7({palmScanCompleted:true,chatStage:nextChatStage});if(scroll)completePanel.scrollIntoView({behavior:"smooth",block:"center"})}
  const showVideoError=()=>{terminal.classList.remove("is-scanning");status.textContent="VIDEO ERROR";message.textContent="YouTube動画を読み込めませんでした。通信環境を確認してページを再読み込みしてください。"};
  window.YouTubeEmbed.create(video,{
    onPlay:()=>{if(completed)return;terminal.classList.add("is-scanning");status.textContent="SCANNING";message.textContent="手のひらを動かさず、そのままお待ちください。"},
    onPause:()=>{if(completed)return;terminal.classList.remove("is-scanning");status.textContent="SCAN PAUSED";message.textContent="スキャンが一時停止しています。再生を続けてください。"},
    onEnded:()=>showComplete({scroll:true}),
    onError:showVideoError
  }).catch(showVideoError);

  document.addEventListener("keydown",event=>{if(event.key!=="Escape")return;if(!lightbox.hidden)closeLightbox();else if(!inventoryLayer.hidden)closeInventory();else if(!chatPanel.hidden)closeChat()});
  renderInventory();
  if(completed)showComplete();
})();
