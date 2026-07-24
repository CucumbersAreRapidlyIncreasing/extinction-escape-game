(()=>{
  "use strict";

  let apiPromise;

  function loadApi(){
    if(window.YT?.Player)return Promise.resolve(window.YT);
    if(apiPromise)return apiPromise;

    apiPromise=new Promise((resolve,reject)=>{
      const previousReady=window.onYouTubeIframeAPIReady;
      const timeout=window.setTimeout(()=>reject(new Error("YouTube Player API timed out")),15000);

      window.onYouTubeIframeAPIReady=()=>{
        if(typeof previousReady==="function")previousReady();
        window.clearTimeout(timeout);
        resolve(window.YT);
      };

      if(!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')){
        const script=document.createElement("script");
        script.src="https://www.youtube.com/iframe_api";
        script.async=true;
        script.onerror=()=>{
          window.clearTimeout(timeout);
          reject(new Error("YouTube Player API could not be loaded"));
        };
        document.head.append(script);
      }
    });

    return apiPromise;
  }

  async function create(element,handlers={}){
    const YT=await loadApi();
    return new Promise(resolve=>{
      let player;
      player=new YT.Player(element,{
        videoId:element.dataset.youtubeId,
        playerVars:{playsinline:1,rel:0},
        events:{
          onReady:()=>resolve(player),
          onStateChange:event=>{
            if(event.data===YT.PlayerState.PLAYING)handlers.onPlay?.(player);
            if(event.data===YT.PlayerState.PAUSED)handlers.onPause?.(player);
            if(event.data===YT.PlayerState.ENDED)handlers.onEnded?.(player);
          },
          onError:event=>handlers.onError?.(event)
        }
      });
    });
  }

  window.YouTubeEmbed={create};
})();
