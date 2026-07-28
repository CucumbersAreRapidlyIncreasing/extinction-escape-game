(() => {
  "use strict";
  // タイムマシン制御室の年代入力と5本のレバー順を個別に判定する。
  // 不正解時は間違った箇所だけを強調し、プレイヤーが再考できるよう入力を残す。
  const levers=[...document.querySelectorAll("[data-lever-index]")],bank=document.querySelector("#lever-bank"),slots=[...document.querySelectorAll("#sequence-slots li")],feedback=document.querySelector("#time-feedback"),indicator=document.querySelector("#time-indicator"),success=document.querySelector("#time-success"),timeInput=document.querySelector("#travel-time"),timeField=document.querySelector("#travel-time-field"),resetButton=document.querySelector("#lever-reset"),judgeButton=document.querySelector("#sequence-judge"),correct=[2,4,0,1,3],correctTime="6500万年";
  let sequence=[],activeIndex=null,completed=Boolean(window.GameProgress?.getState().screen6.timeMachineTested);
  function render(){levers.forEach((lever,index)=>{lever.setAttribute("aria-pressed",String(index===activeIndex));lever.disabled=completed||sequence.length>=5});slots.forEach((slot,index)=>slot.textContent=sequence[index]===undefined?"—":levers[sequence[index]].dataset.colorName)}
  function reset(message="レバー入力を解除しました。1本目から入力してください"){sequence=[];activeIndex=null;slots.forEach(slot=>slot.classList.remove("is-wrong"));render();feedback.textContent=message}
  function showSuccess(){completed=true;document.body.classList.add("time-machine-ready");indicator.innerHTML="<i></i><span>SEQUENCE VERIFIED</span>";feedback.textContent="起動手順のテストに成功しました";success.hidden=false;timeInput.disabled=true;resetButton.disabled=true;judgeButton.disabled=true;render();window.GameProgress?.updateScreen6({timeMachineTested:true});success.scrollIntoView({behavior:"smooth",block:"center"})}
  function judge(){const timeCorrect=timeInput.value.trim()===correctTime;const leverResults=correct.map((value,index)=>sequence[index]===value);timeField.classList.toggle("is-wrong",!timeCorrect);slots.forEach((slot,index)=>slot.classList.toggle("is-wrong",!leverResults[index]));if(timeCorrect&&leverResults.every(Boolean)){showSuccess();return}feedback.textContent=sequence.length<5?"レバーを5回操作してください。間違っている部分を確認してください":"間違っている部分を確認してください"}
  bank.addEventListener("click",event=>{const lever=event.target.closest("[data-lever-index]");if(!lever||completed||sequence.length>=5)return;const index=Number(lever.dataset.leverIndex);if(index===activeIndex)return;activeIndex=index;sequence.push(index);slots[sequence.length-1].classList.remove("is-wrong");render();feedback.textContent=sequence.length===5?"5回の操作を保存しました。判定ボタンを押してください":`${sequence.length}本目：${lever.dataset.colorName}のレバーを入力`});
  timeInput.addEventListener("input",()=>timeField.classList.remove("is-wrong"));
  resetButton.addEventListener("click",()=>reset());
  judgeButton.addEventListener("click",judge);
  render();if(completed)showSuccess();
})();
