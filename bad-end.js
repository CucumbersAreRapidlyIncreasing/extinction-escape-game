(() => {
  "use strict";
  // バッドエンド動画の再生状態を端末表示へ反映し、再生終了後に物語本文を開示する。
  const video=document.querySelector("#bad-ending-video"),terminal=document.querySelector("#bad-video-terminal"),status=document.querySelector("#bad-video-status"),message=document.querySelector("#bad-video-message"),story=document.querySelector("#bad-story");
  let revealed=false;
  function revealStory(){if(revealed)return;revealed=true;terminal.classList.remove("is-playing");terminal.classList.add("is-complete");status.textContent="PLAYBACK COMPLETE";message.textContent="離陸記録の再生が完了しました。";story.hidden=false;requestAnimationFrame(()=>{story.classList.add("is-revealed");story.scrollIntoView({behavior:"smooth",block:"start"})})}
  const showVideoError=()=>{terminal.classList.remove("is-playing");status.textContent="VIDEO ERROR";message.textContent="YouTube動画を読み込めませんでした。通信環境を確認してページを再読み込みしてください。"};
  window.YouTubeEmbed.create(video,{
    onPlay:()=>{if(revealed)return;terminal.classList.add("is-playing");status.textContent="PLAYING";message.textContent="離陸記録を再生しています。"},
    onPause:()=>{if(revealed)return;terminal.classList.remove("is-playing");status.textContent="PAUSED";message.textContent="再生が一時停止しています。"},
    onEnded:revealStory,
    onError:showVideoError
  }).catch(showVideoError);
})();
