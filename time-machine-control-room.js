(() => {
  "use strict";
  const levers=[...document.querySelectorAll("[data-lever-index]")],bank=document.querySelector("#lever-bank"),slots=[...document.querySelectorAll("#sequence-slots li")],feedback=document.querySelector("#time-feedback"),indicator=document.querySelector("#time-indicator"),success=document.querySelector("#time-success"),correct=[2,4,0,1,3];
  let sequence=[],activeIndex=null,completed=Boolean(window.GameProgress?.getState().screen6.timeMachineTested);
  function render(){levers.forEach((lever,index)=>lever.setAttribute("aria-pressed",String(index===activeIndex)));slots.forEach((slot,index)=>slot.textContent=sequence[index]===undefined?"—":levers[sequence[index]].dataset.colorName)}
  function reset(message="1本目のレバーを引いてください"){sequence=[];activeIndex=null;render();feedback.textContent=message}
  function showSuccess(){completed=true;document.body.classList.add("time-machine-ready");indicator.innerHTML="<i></i><span>SEQUENCE VERIFIED</span>";feedback.textContent="起動手順のテストに成功しました";success.hidden=false;levers.forEach(lever=>lever.disabled=true);window.GameProgress?.updateScreen6({timeMachineTested:true});success.scrollIntoView({behavior:"smooth",block:"center"})}
  function judge(){if(correct.every((value,index)=>sequence[index]===value)){showSuccess();return}feedback.textContent="起動手順が正しくないようだ";bank.classList.remove("is-error");void bank.offsetWidth;bank.classList.add("is-error");window.setTimeout(()=>{bank.classList.remove("is-error");reset("起動手順が正しくないようだ。最初から試してください")},650)}
  bank.addEventListener("click",event=>{const lever=event.target.closest("[data-lever-index]");if(!lever||completed)return;const index=Number(lever.dataset.leverIndex);if(index===activeIndex)return;activeIndex=index;sequence.push(index);render();feedback.textContent=`${sequence.length}本目：${lever.dataset.colorName}のレバーを入力`;if(sequence.length===5)judge()});
  render();if(completed)showSuccess();
})();
