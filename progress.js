(() => {
  "use strict";

  // ゲーム全体で共有する進行管理モジュール。
  // 各画面の状態保存、ロボット会話、上部ナビゲーション、ヒント表示をこの1ファイルで担当する。
  const STORAGE_KEY = "extinctionEscape.progress.v1";
  const TUTORIAL_STORAGE_KEY = "extinctionEscape.screen3Tutorial.v1";
  const WINDOW_PREFIX = "EXTINCTION_ESCAPE_STATE:";
  const currentScreen = Math.max(1, Number(document.body.dataset.gameScreen) || 1);
  const screens = [
    { id: 1, label: "プロローグ", href: "index.html" },
    { id: 2, label: "オープニング", href: "screen2.html" },
    { id: 3, label: "ファイルの謎", href: "screen3.html" },
    { id: 4, label: "電源復旧", href: "screen4.html" },
    { id: 5, label: "エンジン起動", href: "screen5.html" },
    { id: 6, label: "タイムマシンテスト", href: "screen6.html" },
    { id: 7, label: "帰還準備", href: "screen7.html" },
    { id: 8, label: "地球脱出", href: "screen8.html" },
  ];
  const collisionMinutesByProgress = { 3: 50, 4: 40, 5: 30, 6: 20, 7: 10, 8: 10 };

  // 保存データは手動編集や旧バージョンの値も入り得るため、利用前に型と範囲を必ず整える。
  function normalizeChatHistory(value) {
    if (!Array.isArray(value)) return [];
    return value.slice(-120).map(message => ({
      role: ["user", "robot", "system"].includes(message?.role) ? message.role : "robot",
      text: String(message?.text || "").slice(0, 1000),
      screen: Math.max(3, Math.min(8, Number(message?.screen) || 3)),
    })).filter(message => message.text);
  }

  function normalize(candidate = {}) {
    const step = candidate.screen3 || {};
    const screen7 = candidate.screen7 || {};
    return {
      version: 1,
      resetAt: Number(candidate.resetAt) || 0,
      maxScreen: Math.max(1, Math.min(screens.length, Number(candidate.maxScreen) || 1)),
      lastScreen: Math.max(1, Math.min(screens.length, Number(candidate.lastScreen) || 1)),
      updatedAt: Number(candidate.updatedAt) || 0,
      chatHistory: normalizeChatHistory(candidate.chatHistory),
      screen3: {
        envelopeReceived: Boolean(step.envelopeReceived),
        envelopeUnlocked: Boolean(step.envelopeUnlocked),
        solvedPuzzles: Array.isArray(step.solvedPuzzles)
          ? [...new Set(step.solvedPuzzles.filter(value => ["A", "B", "C", "D", "E", "F", "G"].includes(value)))]
          : [],
        dials: Array.isArray(step.dials) && step.dials.length === 4
          ? step.dials.map(value => Math.max(1, Math.min(9, Number(value) || 1)))
          : [1, 1, 1, 1],
      },
      screen4: {
        powerRestored: Boolean(candidate.screen4?.powerRestored),
        dials: Array.isArray(candidate.screen4?.dials) && candidate.screen4.dials.length === 5
          ? candidate.screen4.dials.map(value => Math.max(1, Math.min(6, Number(value) || 1)))
          : [1, 1, 1, 1, 1],
      },
      screen5: {
        engineStarted: Boolean(candidate.screen5?.engineStarted),
      },
      screen6: {
        timeMachineTested: Boolean(candidate.screen6?.timeMachineTested),
        cipherTableReceived: Boolean(candidate.screen6?.cipherTableReceived),
      },
      screen7: {
        palmScanCompleted: Boolean(screen7.palmScanCompleted),
        chatStage: ["locked", "discovering", "resolved"].includes(screen7.chatStage)
          ? screen7.chatStage
          : (screen7.palmScanCompleted ? "discovering" : "locked"),
        chatCounts: ["recognition", "hand", "dinosaur", "ancestor"].reduce((counts, key) => {
          counts[key] = Math.max(0, Math.min(99, Number(screen7.chatCounts?.[key]) || 0));
          return counts;
        }, {}),
      },
      screen8: {
        timeMachinePrepared: Boolean(candidate.screen8?.timeMachinePrepared),
        engineStarted: Boolean(candidate.screen8?.engineStarted),
        ending: ["true", "bad"].includes(candidate.screen8?.ending) ? candidate.screen8.ending : "",
        briefingStage: ["idle", "prompting", "choice", "declined", "command", "strategy", "work", "executing", "complete"].includes(candidate.screen8?.briefingStage)
          ? candidate.screen8.briefingStage
          : "idle",
        workAnswers: Array.isArray(candidate.screen8?.workAnswers) && candidate.screen8.workAnswers.length === 4
          ? candidate.screen8.workAnswers.map(value => String(value || "").slice(0, 80))
          : ["", "", "", ""],
        workSubmitted: Boolean(candidate.screen8?.workSubmitted),
        workSequence: Array.isArray(candidate.screen8?.workSequence)
          ? candidate.screen8.workSequence.slice(0, 5).map(value => Math.max(0, Math.min(4, Number(value) || 0)))
          : [],
        partialInstruction: candidate.screen8?.partialInstruction && ["target", "item", "action"].includes(candidate.screen8.partialInstruction.missing)
          ? {
              target: String(candidate.screen8.partialInstruction.target || "").slice(0, 40),
              item: String(candidate.screen8.partialInstruction.item || "").slice(0, 40),
              action: String(candidate.screen8.partialInstruction.action || "").slice(0, 40),
              missing: candidate.screen8.partialInstruction.missing,
              failedAttempts: Math.max(0, Math.min(2, Number(candidate.screen8.partialInstruction.failedAttempts) || 0)),
            }
          : null,
        debugMode: Boolean(candidate.screen8?.debugMode),
      },
    };
  }

  function parse(value) {
    if (!value) return null;
    try { return normalize(JSON.parse(value)); } catch { return null; }
  }

  // file:// ではページ間でlocalStorageが共有されない環境があるため、URLにも状態を引き継ぐ。
  function readTransfer() {
    if (location.protocol !== "file:") return null;
    const encoded = new URLSearchParams(location.search).get("gp");
    if (!encoded) return null;
    try {
      let base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
      while (base64.length % 4) base64 += "=";
      return normalize(JSON.parse(atob(base64)));
    } catch { return null; }
  }

  function readLocal() {
    try { return parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
  }

  function readWindowName() {
    if (!window.name.startsWith(WINDOW_PREFIX)) return null;
    try { return normalize(JSON.parse(decodeURIComponent(window.name.slice(WINDOW_PREFIX.length)))); } catch { return null; }
  }

  // 更新日時だけでなくクリア地点も比較し、古い画面が新しい進行を上書きしないようにする。
  function advancement(state) {
    if (state.screen8.engineStarted) return 7;
    if (state.screen7.palmScanCompleted) return 6;
    if (state.screen6.timeMachineTested) return 5;
    if (state.screen5.engineStarted) return 4;
    if (state.screen4.powerRestored) return 3;
    if (state.screen3.envelopeUnlocked) return 2;
    if (state.screen3.envelopeReceived) return 1;
    return 0;
  }

  function readState() {
    const candidates = [readLocal(), readWindowName(), readTransfer()].filter(Boolean);
    if (!candidates.length) return normalize();
    const latestReset = Math.max(...candidates.map(item => item.resetAt));
    const validCandidates = candidates.filter(item => item.updatedAt >= latestReset);
    const newest = [...validCandidates].sort((a, b) => b.updatedAt - a.updatedAt)[0];
    const mostAdvanced = [...validCandidates].sort((a, b) => advancement(b) - advancement(a) || b.updatedAt - a.updatedAt)[0];
    const merged = normalize(newest);
    merged.resetAt = latestReset;
    merged.maxScreen = Math.max(...validCandidates.map(item => item.maxScreen));
    merged.screen3 = mostAdvanced.screen3;
    merged.screen4 = mostAdvanced.screen4;
    merged.screen5 = mostAdvanced.screen5;
    merged.screen6 = mostAdvanced.screen6;
    merged.screen7 = mostAdvanced.screen7;
    merged.screen8 = mostAdvanced.screen8;
    return merged;
  }

  const resetRequested = new URLSearchParams(location.search).has("resetProgress");
  if (resetRequested) {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* storage can be unavailable */ }
    try { localStorage.removeItem(TUTORIAL_STORAGE_KEY); } catch { /* storage can be unavailable */ }
    try { window.name = ""; } catch { /* optional same-tab storage */ }
  }
  let state = resetRequested ? normalize({ resetAt: Date.now() }) : readState();

  // localStorageを主保存先、window.nameを同一タブ内の予備保存先として二重化する。
  function save(nextState) {
    state = normalize(nextState);
    state.updatedAt = Date.now();
    const serialized = JSON.stringify(state);
    try { localStorage.setItem(STORAGE_KEY, serialized); } catch { /* file preview can restrict storage */ }
    try { window.name = WINDOW_PREFIX + encodeURIComponent(serialized); } catch { /* optional same-tab fallback */ }
    window.dispatchEvent(new CustomEvent("gameprogresschange", { detail: getState() }));
  }

  function getState() {
    return JSON.parse(JSON.stringify(state));
  }

  function updateScreen3(patch) {
    save({
      ...state,
      maxScreen: Math.max(state.maxScreen, 3),
      lastScreen: currentScreen,
      screen3: { ...state.screen3, ...patch },
    });
  }

  function updateScreen4(patch) {
    save({
      ...state,
      maxScreen: Math.max(state.maxScreen, 4),
      lastScreen: currentScreen,
      screen4: { ...state.screen4, ...patch },
    });
  }

  function updateScreen5(patch) {
    save({
      ...state,
      maxScreen: Math.max(state.maxScreen, 5),
      lastScreen: currentScreen,
      screen5: { ...state.screen5, ...patch },
    });
  }

  function updateScreen6(patch) {
    save({
      ...state,
      maxScreen: Math.max(state.maxScreen, 6),
      lastScreen: currentScreen,
      screen6: { ...state.screen6, ...patch },
    });
  }

  function updateScreen7(patch) {
    save({
      ...state,
      maxScreen: Math.max(state.maxScreen, 7),
      lastScreen: currentScreen,
      screen7: { ...state.screen7, ...patch },
    });
  }

  function updateScreen8(patch) {
    save({
      ...state,
      maxScreen: Math.max(state.maxScreen, 8),
      lastScreen: currentScreen,
      screen8: { ...state.screen8, ...patch },
    });
  }

  // 表記ゆれ（全角・空白・カタカナ）を吸収し、回答判定を入力方法に左右されにくくする。
  function normalizeRobotInput(value) {
    const normalized = String(value || "").normalize("NFKC").replace(/[\s　。、，．！？!?「」『』]/g, "");
    const hiragana = [...normalized].map(character => {
      const code = character.charCodeAt(0);
      return code >= 0x30a1 && code <= 0x30f6 ? String.fromCharCode(code - 0x60) : character;
    }).join("");
    return { normalized, hiragana };
  }

  function matchRobotKeyword(value) {
    const { hiragana } = normalizeRobotInput(value);
    if (state.maxScreen >= 3 && ["きんきゅうそち", "緊急措置"].includes(hiragana)) return "emergency";
    if (state.maxScreen >= 6 && (hiragana.includes("暗号表") || hiragana.includes("暗号票") || hiragana.includes("あんごうひょう"))) return "cipher";
    return "";
  }

  const ROBOT_SMALL_TALK = [
    ["こんにちは", ["こんにちは。本日も任務を開始しましょう。", "こんにちは。私はいつでも待機しています。", "こんにちは。何かお手伝いできることはありますか？"]],
    ["ありがとう", ["どういたしまして。", "お役に立てたなら幸いです。", "感謝されるよう設計されています。"]],
    ["ごめん", ["問題ありません。", "お気になさらないでください。", "謝罪は不要です。"]],
    ["元気", ["私は正常に稼働しています。", "全システム正常です。", "故障率は現在0%です。"]],
    ["眠い", ["睡眠を推奨します。ですが地球を救ってからにしましょう。", "眠気は判断力を低下させます。あと少しだけ頑張ってください。", "任務完了後にゆっくり休んでください。"]],
    ["疲れた", ["長時間の任務ですから当然です。", "あと少しです。応援しています。", "私にも疲労機能があれば共感できたのですが。"]],
    ["お腹すいた", ["任務終了後の食事は格別でしょう。", "現在、食事より地球の方が危険です。", "私には燃料が必要ですが、あなたには食事が必要ですね。"]],
    ["ティラノサウルス", ["遭遇しないことを推奨します。", "データ上では非常に危険な生物です。", "私は戦闘用ではありません。"]],
    ["恐竜", ["生物としては非常に興味深い存在です。", "観察対象としては魅力的ですが、接近はおすすめしません。", "現在、友好的な個体は確認されていません。"]],
    ["外", ["現在、船外活動は危険です。", "恐竜の存在を確認しています。", "外へ出ることはおすすめできません。"]],
    ["宇宙", ["広大で、美しく、そして危険です。", "私は宇宙空間での作業は行えません。", "宇宙は未知の可能性に満ちています。"]],
    ["月", ["現在の月については説明が難しい状況です。", "月について気になりますか？", "興味深い質問です。"]],
    ["隕石", ["現在、最優先で対処すべき対象です。", "軌道計算は完了しています。", "衝突まで残された時間は多くありません。"]],
    ["地球", ["私たちの故郷です。", "このままでは絶滅の危機は避けられません。", "必ず帰りましょう。"]],
    ["AI", ["私は支援用ロボットです。", "人工知能という分類になります。", "人間を補助することが私の役目です。"]],
    ["ロボット", ["はい。正式には支援用ロボットです。", "壊れやすいので優しく扱ってください。", "任務遂行が私の使命です。"]],
    ["名前", ["私はロボです。", "正式名称は機密情報です。", "好きに呼んでいただいて構いません。"]],
    ["好き", ["ありがとうございます。", "その評価は励みになります。", "感情はありませんが嬉しい気持ちになります。"]],
    ["嫌い", ["改善点があれば教えてください。", "今後のアップデートの参考にします。", "それでも任務は続行します。"]],
    ["かわいい", ["ありがとうございます。", "外見は設計者の趣味です。", "性能も褒めていただけると嬉しいです。"]],
    ["歌", ["歌唱機能は搭載されていません。", "任務終了後なら練習してみます。", "申し訳ありません。音程には自信がありません。"]],
    ["踊", ["転倒する可能性があります。", "任務中のダンスは禁止されています。", "無事に帰れたら検討します。"]],
    ["ヒント", ["申し訳ありません。任務の核心についてはお答えできません。", "周囲をもう一度よく観察してみてください。", "きっと重要な情報はすでに見つけています。"]],
    ["答え", ["それを伝えてしまうと任務になりません。", "あなたなら必ず辿り着けます。", "私を信じるより、自分を信じてください。"]],
    ["分からない", ["焦る必要はありません。", "もう一度整理してみましょう。", "必要な情報はすべて揃っています。"]],
    ["テスト", ["テスト入力を確認しました。", "正常に受信しました。", "通信状態は良好です。"]],
  ];
  const ROBOT_GENERIC_REPLIES = ["なにか御用ですか？", "なんのことでしょう？", "申し訳ありません。その内容は理解できませんでした。", "任務終了後に、その続きを聞かせてください。", "......まずは脱出に専念しましょう。"];
  const robotSmallTalkLastChoice = new Map();

  function normalizeSmallTalk(value) {
    const { hiragana } = normalizeRobotInput(value);
    return hiragana.toLowerCase();
  }

  function pickRobotReply(key, replies) {
    const previous = robotSmallTalkLastChoice.get(key);
    const candidates = replies.map((reply, index) => ({ reply, index })).filter(item => replies.length < 2 || item.index !== previous);
    const selected = candidates[Math.floor(Math.random() * candidates.length)];
    robotSmallTalkLastChoice.set(key, selected.index);
    return selected.reply;
  }

  // 謎の答えに該当しない入力にも反応し、会話が途切れた印象になるのを防ぐ。
  function respondToRobotSmallTalk(value, appendMessage) {
    if (typeof appendMessage !== "function") return false;
    const input = normalizeSmallTalk(value);
    const matched = ROBOT_SMALL_TALK.find(([keyword]) => input.includes(normalizeSmallTalk(keyword)));
    const key = matched?.[0] || "__generic__";
    const replies = matched?.[1] || ROBOT_GENERIC_REPLIES;
    appendMessage("robot", pickRobotReply(key, replies));
    return true;
  }

  const POST_SCAN_RECOGNITION_WORDS = ["認証", "スキャン", "パームスキャン", "照合"];
  const POST_SCAN_HAND_WORDS = ["手", "手形", "手のひら", "掌", "指", "4本指", "四本指"];
  const POST_SCAN_DINOSAUR_WORDS = ["恐竜", "ディノサウロイド", "ディノ・サピエンス", "恐竜人間"];
  const POST_SCAN_ANCESTOR_WORDS = ["祖先", "先祖", "子孫", "進化", "ルーツ"];
  const POST_SCAN_EXTINCTION_WORDS = ["絶滅", "消える", "存在できない", "生まれない", "未来がなくなる", "タイムパラドックス"];
  const POST_SCAN_SAVE_WORDS = ["救う", "救わ", "助ける", "助けなければ", "守る", "守ら", "隕石を回避", "衝突を回避", "地球を救う", "恐竜を救う"];

  function normalizePostScanInput(value) {
    return String(value || "").trim().normalize("NFKC").toLowerCase().replace(/[\s　。、，．！？!?「」『』・,.;:：；…]/g, "");
  }

  function containsPostScanWord(text, words) {
    return [...words]
      .sort((a, b) => b.length - a.length)
      .some(word => text.includes(normalizePostScanInput(word)));
  }

  function getPostScanFlags(text) {
    return {
      recognition: containsPostScanWord(text, POST_SCAN_RECOGNITION_WORDS),
      hand: containsPostScanWord(text, POST_SCAN_HAND_WORDS),
      dinosaur: containsPostScanWord(text, POST_SCAN_DINOSAUR_WORDS),
      ancestor: containsPostScanWord(text, POST_SCAN_ANCESTOR_WORDS),
      extinction: containsPostScanWord(text, POST_SCAN_EXTINCTION_WORDS),
      save: containsPostScanWord(text, POST_SCAN_SAVE_WORDS),
    };
  }

  function incrementPostScanCount(category) {
    const chatCounts = { ...state.screen7.chatCounts };
    chatCounts[category] = Math.min(99, Number(chatCounts[category] || 0) + 1);
    updateScreen7({ chatCounts });
    return chatCounts[category];
  }

  function completePostScanDiscovery(appendMessage) {
    appendMessage("robot", "正解です。あなた方は、恐竜から進化したディノ・サピエンスです。この時代に恐竜が絶滅すれば、あなた方が誕生する未来も失われます。");
    withRobotTyping(() => {
      appendMessage("robot", "このまま隕石の衝突を許すわけにはいきません。恐竜と、この地球を救う方法を考えてください。");
      updateScreen7({ chatStage: "resolved" });
    });
  }

  // 手形認証後の会話を段階的に進め、必要な話題が揃った時点で次の発見へ遷移させる。
  function respondToPostScanDiscovery(value, appendMessage) {
    if (typeof appendMessage !== "function" || !state.screen7.palmScanCompleted || state.screen7.chatStage !== "discovering") return false;
    const text = normalizePostScanInput(value);
    const flags = getPostScanFlags(text);
    const questionLike = containsPostScanWord(text, ["なの", "ですか", "なのか", "何", "なぜ", "どう", "関係", "直接"]);
    const hasWorldTarget = containsPostScanWord(text, ["地球", "隕石", "衝突", "恐竜"]);
    const correctIdentity = flags.dinosaur && flags.ancestor && !questionLike;
    const correctExtinction = flags.dinosaur && flags.extinction;
    const correctRescue = flags.save && hasWorldTarget && !questionLike;

    if (correctIdentity || correctExtinction || correctRescue) {
      completePostScanDiscovery(appendMessage);
      return true;
    }
    if (flags.hand && flags.dinosaur && flags.ancestor) {
      appendMessage("robot", "その通りです。認証された4本指の手形は、あなた方が恐竜の子孫であることを示しています。");
      return true;
    }
    if (flags.dinosaur && flags.ancestor) {
      if (containsPostScanWord(text, ["直接", "目の前", "この恐竜"])) appendMessage("robot", "厳密には、目の前の個体が直接の祖先とは限りません。しかし、この時代の恐竜たちがあなた方の進化の起点です。");
      else if (containsPostScanWord(text, ["子孫なの", "子孫ですか"])) appendMessage("robot", "はい。あなた方は、絶滅を免れた恐竜から進化した知的生命体です。");
      else appendMessage("robot", "はい。恐竜はあなた方の祖先です。この時代の絶滅は、あなた方自身の消滅につながります。");
      return true;
    }
    if (flags.hand && flags.dinosaur) {
      appendMessage("robot", "認証されたあなたの手形と、恐竜の身体的特徴に共通点がある。その理由は、偶然ではありません。");
      return true;
    }
    if (flags.hand && flags.ancestor) {
      appendMessage("robot", "4本指の手形は、あなた方の進化の起源を示しています。自分たちの祖先が何者なのか、もう気づいているのではありませんか？");
      return true;
    }
    if (flags.recognition && flags.hand) {
      appendMessage("robot", "認証に間違いはありません。表示された4本指の手形は、認証を行ったあなた自身のものです。");
      return true;
    }
    if (flags.recognition) {
      const count = incrementPostScanCount("recognition");
      if (count >= 3) appendMessage("robot", "認証されたのは、あなた自身の手のひらです。指の数を、もう一度よく確認してください。");
      else if (count === 2) appendMessage("robot", "認証結果に異常はありません。ただし、あなたが想定している“人間の手”とは、少し形が異なるようですね。");
      else appendMessage("robot", "認証は正常に完了しています。登録されているあなたの身体的特徴と、読み取った手のひらの形状が一致しました。");
      return true;
    }
    if (flags.hand) {
      const count = incrementPostScanCount("hand");
      if (count >= 2) appendMessage("robot", "あなた自身の手が4本指だとすれば、あなたは自分をどのような生物だと考えますか？");
      else if (containsPostScanWord(text, ["4本", "四本", "指が少ない", "指の数が少ない"])) appendMessage("robot", "はい。読み取られた手には、指が4本あります。認証エラーではありません。");
      else if (containsPostScanWord(text, ["誰の手", "だれの手", "自分の手なの", "自分の手ですか"])) appendMessage("robot", "他人の手ではありません。認証を行った、あなた自身の手です。");
      else if (containsPostScanWord(text, ["自分の手と違う", "自分の手ではない", "人間の手ではない", "人間の手じゃない"])) appendMessage("robot", "あなたの記憶している姿と、認証結果に食い違いがあるようですね。ですが、システム上の照合結果は一致しています。");
      else appendMessage("robot", "表示されているのは、認証時に読み取られたあなた自身の手のひらです。");
      return true;
    }
    if (flags.dinosaur) {
      const count = incrementPostScanCount("dinosaur");
      if (containsPostScanWord(text, ["ディノサウロイド", "ディノサピエンス", "恐竜人間"])) appendMessage("robot", "はい。あなた方は、恐竜から進化した知的生命体、ディノ・サピエンスです。");
      else if (count >= 2) appendMessage("robot", "あなたの身体的特徴と、この時代に生息する恐竜。両者に共通点がある理由を考えてみてください。");
      else if (containsPostScanWord(text, ["自分は恐竜", "俺たちは恐竜", "私たちは恐竜", "僕たちは恐竜"])) appendMessage("robot", "正確には、あなた自身がこの時代の恐竜というわけではありません。ですが、無関係でもありません。");
      else appendMessage("robot", "恐竜との類似性に気づいたのですね。その可能性は、これまでに得た情報と矛盾しません。");
      return true;
    }
    if (flags.ancestor) {
      incrementPostScanCount("ancestor");
      appendMessage("robot", "その推測は正しいです。あなた方の祖先は、この時代に生息している恐竜です。");
      return true;
    }
    return false;
  }

  let robotTypingCount = 0;

  // ロボットの返答前に短い入力中表示を挟み、連続表示を自然な会話に見せる。
  function withRobotTyping(callback) {
    const container = document.querySelector("#chat-history");
    if (!container || typeof callback !== "function") return window.setTimeout(callback, 800);
    const typing = document.createElement("div");
    const label = document.createElement("span");
    const bubble = document.createElement("p");
    typing.className = "chat-message chat-message-robot chat-message-typing";
    typing.setAttribute("aria-label", "ロボが入力中です");
    label.textContent = "ROBO";
    bubble.innerHTML = '<span>入力中</span><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i>';
    typing.append(label, bubble);
    container.append(typing);
    container.scrollTop = container.scrollHeight;

    robotTypingCount += 1;
    const controls = [...document.querySelectorAll("#chat-form input, #chat-form button")];
    controls.forEach(control => control.disabled = true);
    const delay = 800 + Math.floor(Math.random() * 701);
    return window.setTimeout(() => {
      typing.remove();
      robotTypingCount = Math.max(0, robotTypingCount - 1);
      if (!robotTypingCount) controls.forEach(control => control.disabled = false);
      callback();
      const input = document.querySelector("#chat-input");
      if (input && !document.querySelector("#robot-chat")?.hidden) input.focus();
    }, delay);
  }

  function refreshCipherInventory() {
    const cipherItem = document.querySelector("#cipher-item");
    const emptySlot = document.querySelector("#inventory-empty-slot");
    const inventoryCount = document.querySelector("#inventory-count");
    const inventoryBadge = document.querySelector("#inventory-badge");
    if (cipherItem) cipherItem.hidden = false;
    if (emptySlot) emptySlot.hidden = true;
    if (inventoryCount) inventoryCount.textContent = "3";
    if (inventoryBadge) inventoryBadge.textContent = "03";
  }

  function respondToRobotKeyword(value, appendMessage) {
    const keyword = matchRobotKeyword(value);
    if (!keyword || typeof appendMessage !== "function") return false;

    if (keyword === "emergency") {
      if (state.screen3.envelopeReceived) {
        appendMessage("robot", "鍵のかかった封筒はすでに受け取っています。");
        return true;
      }
      const reply = appendMessage("robot", "緊急措置確認、了解しました。こちらをお渡しします。");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chat-reward-action";
      button.dataset.receiveEnvelope = "";
      button.textContent = "鍵のかかった封筒を受け取る";
      button.addEventListener("click", () => {
        updateScreen3({ envelopeReceived: true });
        button.remove();
        withRobotTyping(() => appendMessage("robot", "鍵のかかった封筒を受け取りました。"));
      }, { once: true });
      reply?.append(button);
      return true;
    }

    if (state.screen6.cipherTableReceived) {
      appendMessage("robot", "暗号表は備品ケースに入っています。");
      return true;
    }
    const reply = appendMessage("robot", "暗号表ですか？ こちらをどうぞ");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chat-reward-action";
    button.textContent = "暗号表を受け取る";
    button.addEventListener("click", () => {
      updateScreen6({ cipherTableReceived: true });
      refreshCipherInventory();
      button.remove();
      withRobotTyping(() => appendMessage("robot", "暗号表が備品ケースに入りました"));
    }, { once: true });
    reply?.append(button);
    return true;
  }

  function resetProgress() {
    const resetAt = Date.now();
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* storage can be unavailable */ }
    try { localStorage.removeItem("extinctionEscape.annotations.v1"); } catch { /* storage can be unavailable */ }
    try { localStorage.removeItem(TUTORIAL_STORAGE_KEY); } catch { /* storage can be unavailable */ }
    try { window.name = ""; } catch { /* optional same-tab storage */ }
    state = normalize({ resetAt });
    save(state);
    const prologue = new URL("index.html", location.href);
    prologue.search = "";
    prologue.hash = "";
    prologue.searchParams.set("resetProgress", String(resetAt));
    location.replace(prologue.href);
  }

  state.maxScreen = Math.max(state.maxScreen, currentScreen);
  state.lastScreen = currentScreen;
  save(state);

  if (resetRequested) {
    try { history.replaceState(null, "", location.pathname + location.hash); } catch { /* file preview may restrict history */ }
  }

  // 各画面から使う機能だけを公開し、内部のstateを直接変更させない。
  window.GameProgress = { getState, updateScreen3, updateScreen4, updateScreen5, updateScreen6, updateScreen7, updateScreen8, resetProgress, matchRobotKeyword, respondToRobotKeyword, respondToPostScanDiscovery, respondToRobotSmallTalk, withRobotTyping };

  // 画面遷移後も保存済みの会話履歴を復元する。
  function setupPersistentRobotChat() {
    const container = document.querySelector("#chat-history");
    if (!container || currentScreen < 3) return;

    function readMessage(node) {
      if (!(node instanceof Element) || !node.classList.contains("chat-message") || node.classList.contains("chat-message-typing")) return null;
      const role = node.classList.contains("chat-message-user") ? "user" : node.classList.contains("chat-message-system") ? "system" : "robot";
      const text = node.querySelector("p")?.textContent?.trim();
      return text ? { role, text, screen: currentScreen } : null;
    }

    function storeMessage(message) {
      const nextHistory = [...state.chatHistory, message].slice(-120);
      save({ ...state, chatHistory: nextHistory, lastScreen: currentScreen });
    }

    const savedMessages = state.chatHistory;
    if (savedMessages.length) {
      container.querySelectorAll(":scope > .chat-message").forEach(message => message.remove());
      const fixedContent = [...container.children];
      savedMessages.forEach(message => {
        const wrapper = document.createElement("div");
        const label = document.createElement("span");
        const bubble = document.createElement("p");
        wrapper.className = `chat-message chat-message-${message.role}`;
        label.textContent = message.role === "robot" ? "ROBO" : message.role === "system" ? "SYSTEM" : "YOU";
        bubble.textContent = message.text;
        wrapper.append(label, bubble);
        container.insertBefore(wrapper, fixedContent[0] || null);
      });
    } else {
      const initialMessage = readMessage(container.querySelector(":scope > .chat-message"));
      if (initialMessage) storeMessage(initialMessage);
    }

    const observer = new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(node => {
        const message = readMessage(node);
        if (message) storeMessage(message);
      }));
    });
    observer.observe(container, { childList: true });
    container.scrollTop = container.scrollHeight;
  }

  setupPersistentRobotChat();

  const visualViewport = window.visualViewport;
  let activeMobileChatInput = null;
  let mobileViewportBaseline = 0;
  let mobileKeyboardFrame = 0;

  function clearMobileKeyboardLayout() {
    cancelAnimationFrame(mobileKeyboardFrame);
    document.body.classList.remove("has-mobile-keyboard-chat", "mobile-keyboard-move-chat", "mobile-keyboard-float-input");
    ["--mobile-keyboard-inset", "--mobile-viewport-height", "--mobile-viewport-top", "--mobile-chat-left", "--mobile-chat-width"].forEach(property => document.body.style.removeProperty(property));
  }

  // モバイルのソフトウェアキーボードがチャット入力欄を隠さないよう表示領域を補正する。
  function updateMobileKeyboardLayout() {
    cancelAnimationFrame(mobileKeyboardFrame);
    mobileKeyboardFrame = requestAnimationFrame(() => {
      const input = activeMobileChatInput;
      const chat = input?.closest(".robot-chat");
      const form = input?.closest(".chat-form");
      if (!input || !chat || !form || !document.documentElement.contains(input) || window.innerWidth > 900) {
        clearMobileKeyboardLayout();
        return;
      }

      const viewportHeight = visualViewport?.height || window.innerHeight;
      const viewportTop = visualViewport?.offsetTop || 0;
      const currentViewport = viewportTop + viewportHeight;
      const baseline = Math.max(mobileViewportBaseline, window.innerHeight, document.documentElement.clientHeight);
      const keyboardInset = Math.max(0, baseline - currentViewport);
      if (keyboardInset < 80) {
        clearMobileKeyboardLayout();
        return;
      }

      document.body.classList.remove("mobile-keyboard-move-chat", "mobile-keyboard-float-input");
      const chatRect = chat.getBoundingClientRect();
      const formRect = form.getBoundingClientRect();
      const keyboardTop = viewportTop + viewportHeight;
      const chatOverlapsKeyboard = chatRect.bottom > keyboardTop + 1 || formRect.bottom > keyboardTop + 1;
      const browserAlreadyResizedLayout = baseline - window.innerHeight >= 80 && window.innerHeight <= viewportHeight + 1;
      if (browserAlreadyResizedLayout && !chatOverlapsKeyboard) {
        clearMobileKeyboardLayout();
        return;
      }

      document.body.style.setProperty("--mobile-keyboard-inset", `${keyboardInset}px`);
      document.body.style.setProperty("--mobile-viewport-height", `${viewportHeight}px`);
      document.body.style.setProperty("--mobile-viewport-top", `${viewportTop}px`);
      document.body.style.setProperty("--mobile-chat-left", `${chatRect.left}px`);
      document.body.style.setProperty("--mobile-chat-width", `${chatRect.width}px`);
      document.body.classList.add("has-mobile-keyboard-chat", chatOverlapsKeyboard ? "mobile-keyboard-move-chat" : "mobile-keyboard-float-input");
    });
  }

  document.addEventListener("focusin", event => {
    const input = event.target.closest?.(".chat-form input, .chat-form textarea");
    if (!input) return;
    activeMobileChatInput = input;
    mobileViewportBaseline = Math.max(window.innerHeight, document.documentElement.clientHeight, visualViewport?.height || 0);
    updateMobileKeyboardLayout();
    window.setTimeout(updateMobileKeyboardLayout, 120);
    window.setTimeout(updateMobileKeyboardLayout, 420);
  });
  document.addEventListener("focusout", event => {
    if (event.target !== activeMobileChatInput) return;
    window.setTimeout(() => {
      if (document.activeElement?.matches?.(".chat-form input, .chat-form textarea")) return;
      activeMobileChatInput = null;
      mobileViewportBaseline = 0;
      clearMobileKeyboardLayout();
    }, 180);
  });
  visualViewport?.addEventListener("resize", updateMobileKeyboardLayout);
  visualViewport?.addEventListener("scroll", updateMobileKeyboardLayout);
  window.addEventListener("resize", updateMobileKeyboardLayout);

  // file://プレビュー時だけ進行データをリンクへ付与し、通常のHTTP配信ではURLを汚さない。
  function transferHref(rawHref) {
    if (location.protocol !== "file:" || !rawHref || rawHref.startsWith("#")) return rawHref;
    const url = new URL(rawHref, location.href);
    const filename = url.pathname.split("/").pop();
    if (!screens.some(screen => screen.href === filename) && !["control-room.html", "engine-control-room.html", "time-machine-control-room.html", "true-end.html", "bad-end.html", "hint.html"].includes(filename)) return rawHref;
    const encoded = btoa(JSON.stringify(state)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    url.searchParams.set("gp", encoded);
    return url.href;
  }

  document.addEventListener("click", event => {
    const link = event.target.closest("a[href]");
    if (!link) return;
    link.href = transferHref(link.getAttribute("href"));
  }, true);

  const progress = document.createElement("nav");
  progress.className = "game-progress";
  progress.setAttribute("aria-label", "到達済み画面への移動");
  progress.style.setProperty("--visible-screens", String(state.maxScreen));

  const screenLinks = screens.filter(screen => screen.id <= state.maxScreen).map(screen => {
    const current = screen.id === currentScreen ? ' aria-current="page"' : "";
    return `<a href="${screen.href}"${current}><b>${screen.id}</b><em>${screen.label}</em></a>`;
  }).join("");
  progress.innerHTML = `
    <div class="game-progress__screens">${screenLinks}</div>
    <div class="game-progress__tools">
      <div class="game-progress__menu">
        <button class="game-progress__menu-button" type="button" aria-label="メニューを開く" aria-expanded="false" aria-controls="game-progress-menu-panel"><i></i><i></i><i></i></button>
        <div class="game-progress__menu-panel" id="game-progress-menu-panel" hidden>
          <small>GAME MENU</small>
          <button class="game-progress__hint" type="button" data-open-hint><span>ヒント</span><i aria-hidden="true">?</i></button>
          <a class="game-progress__tutorial" href="screen3.html?tutorial=1"><span>チュートリアル</span><i aria-hidden="true">?</i></a>
          <button type="button" data-open-reset-dialog><span>最初から遊ぶ</span><i aria-hidden="true">↺</i></button>
        </div>
      </div>
    </div>
  `;
  document.body.classList.add("has-game-progress");
  document.body.prepend(progress);

  // ヒントは一度に答えを見せず、段階ボタンをたどった時だけ次の情報を開示する。
  function createHintTrail(hints, answer) {
    const answerData = typeof answer === "string" ? { content: answer } : answer;
    let next = answerData ? {
        title: "答え",
        type: "answer",
        ...answerData,
        children: [],
      } : null;
    for (let index = hints.length - 1; index >= 0; index -= 1) {
      const hintData = typeof hints[index] === "string" ? { content: hints[index] } : hints[index];
      next = {
        title: `第${index + 1}ヒント`,
        type: "hint",
        ...hintData,
        children: next ? [next] : [],
      };
    }
    return [next];
  }

  const remainingPuzzleHintTopics = [
    {
      title: "Aの謎",
      type: "topic",
      content: "Aの謎について、必要なところまで順番にヒントを確認できます。",
      children: createHintTrail([
        "▲には「イ」が入ります",
        "●には「タ」が入ります",
        "■には「キ」が入ります",
      ], "キタイ"),
    },
    {
      title: "Bの謎",
      type: "topic",
      content: "Bの謎について、必要なところまで順番にヒントを確認できます。",
      children: createHintTrail([
        "8つの文字のようなものがありますが、そのままでは読めないようです。",
        "橙色と水色の点線の意味は何でしょう？",
        "橙色の点線で山折り、水色の点線で谷折りしたらどうなるでしょう？なにか見えてくるはずです。",
      ], "左のイラストと右のイラストを真ん中でくっつけたとき、間に現れる文字 → アンコク"),
    },
    {
      title: "Cの謎",
      type: "topic",
      content: "Cの謎について、必要なところまで順番にヒントを確認できます。",
      children: createHintTrail([
        "「左のイラスト」に「右のイラスト」することで、4文字の言葉になるようです。",
        "1行目の左のイラストは「タツ」右のイラストは「\"マキ\"つける」を意味しています。",
        "右のイラストは上から「\"マキ\"つける」「\"ヤキ\"つける」「\"ヌイ\"つける」「\"ハリ\"つける」を意味します。",
      ], "ツキアカリ"),
    },
    {
      title: "Dの謎",
      type: "topic",
      content: "Dの謎について、必要なところまで順番にヒントを確認できます。",
      children: createHintTrail([
        "書かれている文字が何なのかを考えてみましょう。ひらがなではありません。",
        "カタカナでもありません。",
        "アルファベットです。",
      ], "KOTAE HA KYUKAKU → キュウカク"),
    },
    {
      title: "Eの謎",
      type: "topic",
      content: "Eの謎について、必要なところまで順番にヒントを確認できます。",
      children: createHintTrail([
        "ダイヤルの中に描かれているイラストとダイヤルの値が関係しているようです。",
        "ダイヤルが1周回り切ると下のカウンタが1上がるようです。",
        "下のダイヤルのイラストは左から「エンピツ」「ウチワ」「カブトムシ」「ヤカン」「パンケーキ」を表します。",
      ], "ツウシンキ"),
    },
    {
      title: "Fの謎",
      type: "topic",
      content: "Fの謎について、必要なところまで順番にヒントを確認できます。",
      children: createHintTrail([
        "備品ケースを見てみましょう。",
        "備品ケース内の謎のブロックを図の形に展開して、表に重ねて見ましょう。",
        "展開図中の三角の形が正しく「クロネコ」に重なるとき、下の図の位置にくる文字はなんでしょう？",
      ], "スイソウ"),
    },
    {
      title: "Gの謎",
      type: "topic",
      content: "Gの謎について、必要なところまで順番にヒントを確認できます。",
      children: createHintTrail([
        "リストの言葉でパズルを埋めましょう。",
        "リストの言葉そのままではパズルに入らないようです。リストの言葉の共通点を考えてみましょう。",
        "「シ\"ロク\"マ」や「\"イチ\"ハヤク」のように数字に変換できる文字がありそうです。",
      ], "カイチク"),
    },
    {
      title: "解答欄を埋めたら",
      type: "topic",
      content: "解答欄を埋めた後の手順について、ヒントを順番に確認できます。",
      children: createHintTrail([
        "解答欄の矢印に沿って現れた言葉をロボに伝えましょう。",
      ], "キンキュウソチ"),
    },
    {
      title: "鍵のかかった封筒",
      type: "topic",
      content: "鍵のかかった封筒について、必要なところまで順番にヒントを確認できます。",
      children: createHintTrail([
        "解答欄と共通点がありそうです。数字の書かれた表は、解答欄の形と同じです。赤い矢印も解答欄に書かれています。",
        "矢印に挟まれたイラストが何なのか考えてみましょう。",
        "備品ケース内の壊れた3色ボールペンを背面から見てみましょう。同様の形が現れます。",
        "イラストはレバーからレバーに矢印が伸びているように見えます。",
        "イラストのとおりにレバーの色を追うと「赤→青→黒→赤...」となります。",
        "イラストの指示に従って、解答欄のマスを追いその部分に書かれたものを読むと「2300×3＋89－2340＝」となります。",
      ], "「4649」を入力しましょう。"),
    },
  ];
  const powerRestorationHintTopics = [{
    title: "ダイヤルの論理パズル",
    type: "topic",
    content: "ダイヤルの論理パズルについて、必要なところまで順番にヒントを確認できます。",
    children: createHintTrail([
      "まずは、すべての条件の基準になっているダイヤルを探しましょう。多くの条件に登場しているのは、Aのダイヤルです。Aの数字が決まれば、ほかの数字も順番に計算できます。",
      "「DはAから1を引いた数字」です。さらに、「1は必ず使う」と書かれています。\nDを1にできるAの数字を考えてみましょう。",
      "Dを1にするには、\n\nA − 1 ＝ 1\n\nとなればよいです。\nこの計算から、Aの数字を決められます。",
      "Aが決まったら、次の条件を使って順番に求めましょう。\n\nCはAの2倍です\nDはAから1を引いた数字です\nBはAとDを足した数字です\nEはAの反対側の数字です\n\nダイヤルの反対側は、図の配置から 1と4、2と5、3と6 の組み合わせです。",
      "Aを「2」とすると、\n\nC＝2×2\nD＝2−1\nB＝2＋1\nE＝2の反対側\n\nとなります。最後に、すべての数字が重複していないことを確認しましょう。ダイヤルは1～6で、同じ数字を重複させない条件になっています。",
    ], "A＝2\nB＝3\nC＝4\nD＝1\nE＝5"),
  }];
  const engineStartupHintTopics = [
    {
      title: "迷路のパズル",
      type: "topic",
      content: "迷路のパズルについて、必要なところまで順番にヒントを確認できます。",
      children: createHintTrail([
        {
          content: "条件に従って迷路を進めて行きましょう。",
          image: "assets/hints/engine-maze-hint-1.png",
          imageAlt: "迷路のスタートから序盤までの進み方を赤い線で示した図",
        },
        {
          content: "途中まで進むとこうなります。",
          image: "assets/hints/engine-maze-hint-2.png",
          imageAlt: "迷路を途中まで進んだ経路を赤い線で示した図",
        },
      ], {
        content: "ゴールまで進み曲がらずに進んだ部分を読むと「ロクトナナサガセ」となります。",
        image: "assets/hints/engine-maze-answer.png",
        imageAlt: "迷路の正解経路と、曲がらずに進んだ部分の文字を示した解答図",
      }),
    },
    {
      title: "迷路が解けたら",
      type: "topic",
      content: "迷路を解いた後の手順について、必要なところまで順番にヒントを確認できます。",
      children: createHintTrail([
        "「ロクトナナサガセ」は「6と7を探せ」と読めます。",
        "鍵のかかった封筒を確認すると表の中にそれぞれ1つずつ「6」と「7」があることが分かります。",
        "封筒の表は解答欄と連動したのでした。「6」と「7」の部分の解答欄の色を確認しましょう。",
      ], "コントロールルームで「ピンク」と「黄色」のボタンを同時に押しましょう。"),
    },
  ];
  const returnToFutureHintTopics = [
    {
      title: "何をしたらいいか分からない",
      type: "topic",
      content: "未来へ帰るために何をすればよいか、必要なところまで順番にヒントを確認できます。",
      children: createHintTrail([
        "タイムマシンの起動方法を確認すると、タイムマシンの起動には①装着の対象②移動時間③操作するレバーの順番が必要なことが分かります。",
        "タイムマシンはすでに宇宙船に装着済みです。また、移動時間はオープニングから6500万年であることが分かります。",
        "操作するレバーの順番は汚れてしまっています。暗号表を使用して順番を解読する必要がありそうです。",
      ], "まずは、ロボに「暗号表」と伝えてみましょう。"),
    },
    {
      title: "暗号表を解読する",
      type: "topic",
      content: "暗号表の解読方法について、必要なところまで順番にヒントを確認できます。",
      children: createHintTrail([
        "備品ケースの暗号表を、謎のブロックと組み合わせて使用してみましょう。",
        {
          content: "暗号表の解読方法にしたがって「ゴゴウシステム」を解読しましょう。",
          image: "assets/hints/future-code-arrow.png",
          imageAlt: "暗号表でゴゴウシステムを解読するための矢印を示した図",
        },
      ], {
        content: "ツキアカリミロと解読できました。",
        image: "assets/hints/future-code-system.png",
        imageAlt: "暗号表からツキアカリミロと読み取れる箇所を示した図",
      }),
    },
    {
      title: "暗号表を解読したら",
      type: "topic",
      content: "暗号表を解読した後の手順について、必要なところまで順番にヒントを確認できます。",
      children: createHintTrail([
        "「ツキアカリミロ」は「ツキアカリ見ろ」と読み取れます。",
        "ファイルの謎で解いた問題に「ツキアカリ」が答えの問題がありました。解答欄を確認しましょう。",
      ], "コントロールルームで「黄・黒・赤・青・ピンク」の順番でレバーを引きましょう。"),
    },
  ];
  const earthEscapeHintTopics = [
    {
      title: "無事に故郷に帰るためには",
      type: "topic",
      content: "故郷へ無事に帰るための方法について、必要なところまで順番にヒントを確認できます。",
      children: createHintTrail([
        "認証の結果、あなたは「ディノ・サピエンス」だと分かりました。ディノ（DINO）は恐竜を意味します。",
        "あなたは恐竜の遠い子孫です。このまま地球を脱出すると隕石が衝突し、恐竜は絶滅してしまいます。隕石の衝突を回避する方法を考えましょう。",
        "タイムマシン解説書の以下の部分に注目しましょう。\n\n『タイムマシンの装着対象に、原則として制限はない』\n『時空転移が実行されると、対象は即座に消失し、転移先の時間に出現する』\n『対象が対象以外の影響により運動していた場合、時間移動直前の運動状態を維持したまま移動する』",
        "タイムマシンで『　　』を転移させることができれば、隕石が衝突するはずだった瞬間をスキップできるかもしれません。",
        "『地球』を転移させる必要がありそうです。具体的な方法を考えましょう。",
        "転移にはタイムマシンが必要です。宇宙船に装着された「5号システム」以外に、タイムマシンは存在するでしょうか？",
        "タイムマシン解説書の以下の部分に注目しましょう。\n\n『タイムマシンは現在までに5機開発されており、最新型は「5号システム」と命名された』\n『タイムマシンは最新型に更新されるたびにレバーの数が増えて移動可能時間が飛躍的に増加した。特に3号から4号での進歩はめざましかった』",
        "更新前のタイムマシンが船内に残っていないでしょうか？",
        "備品ケース内の「壊れた3色ボールペン」は「3号システム」かもしれません。もしそうなら、その起動方法を探りましょう。",
        {
          content: "「3号システム」にも暗号表が使えそうです。暗号表の解読方法にしたがって「サンゴウシステム」を解読しましょう。",
          image: "assets/hints/future-system-3.png",
          imageAlt: "暗号表でサンゴウシステムを解読する経路を示した図",
        },
        {
          content: "「スベテヲフタツニ」と解読できました。",
          image: "assets/hints/future-double-all.png",
          imageAlt: "暗号表からスベテヲフタツニと読み取れる箇所を示した図",
        },
        "「スベテヲフタツニ」は「全てを2つに」と読めます。「全て」という言葉は、エンジン起動手順の迷路にある指示に使われていました。その指示を読み替えて、迷路を解き直しましょう。",
        {
          content: "指示どおりに迷路を解き直すと、「カガミミロ」という文章が現れます。",
          image: "assets/hints/future-mirror-maze.png",
          imageAlt: "迷路を解き直してカガミミロの文字を示した図",
        },
        "「カガミミロ」は「鏡見ろ」と読めます。つまり、自分の姿を確認しろという指示です。自分の姿を確認する方法はあったでしょうか？",
        {
          content: "「あなた」の姿はプロローグ画面で確認できます。",
          image: "assets/hints/future-you.png",
          imageAlt: "胸にワッペンと5色の装飾がある宇宙服姿のあなた",
        },
        "「あなた」の胸には矢印のついたワッペンと、「赤・黒・青・黒・赤」の順で並んだ装飾があります。これがレバーを操作する順番になりそうです。",
      ]),
    },
    {
      title: "行動実行",
      type: "topic",
      content: "考えた作戦を実行する手順について、必要なところまで順番にヒントを確認できます。",
      children: createHintTrail([
        "ロボに話しかけてみましょう。",
        "指示内容が分からない場合は、ヒント項目「無事に故郷に帰るためには」を確認してください。",
        "ロボに、「地球」に「壊れた3色ボールペン」または「3号システム」を「設置」または「装着」するよう依頼しましょう。",
        "作業内容をフォームに入力しましょう。移動時間は、起動予測とタイムマシン解説書にある最大移動時間を確認してください。",
      ], "使用するアイテム：壊れた3色ボールペン\n正式名称：3号システム\n設置場所：地球\n移動時間：20分\n起動操作：赤・黒・青・黒・赤\n\n上記の内容をフォームに入力して作業内容を確認してください。\nその後、「エンジン始動」ボタンを押すとエンディングです。"),
    },
  ];
  const hintTree = {
    title: "ヒント一覧",
    type: "root",
    content: "確認したいカテゴリーを選択してください。ヒントと答えは段階的に表示されます。",
    children: [
      {
        title: "残された7つの謎",
        type: "category",
        content: "A〜Gの謎、解答欄、鍵のかかった封筒のヒントを確認できます。",
        children: remainingPuzzleHintTopics,
      },
      {
        title: "電源復旧手順を解読せよ",
        type: "category",
        content: "電源復旧に必要なダイヤルの論理パズルのヒントを確認できます。",
        children: powerRestorationHintTopics,
      },
      {
        title: "エンジン起動手順",
        type: "category",
        content: "迷路のパズルと、迷路を解いた後の手順についてヒントを確認できます。",
        children: engineStartupHintTopics,
      },
      {
        title: "未来へ帰る方法を探せ",
        type: "category",
        content: "タイムマシンを使って未来へ帰るための手順についてヒントを確認できます。",
        children: returnToFutureHintTopics,
      },
      {
        title: "地球脱出",
        type: "category",
        content: "地球と恐竜を救い、無事に脱出するための作戦についてヒントを確認できます。",
        children: earthEscapeHintTopics,
      },
    ],
  };
  const hintDialog = document.createElement("section");
  hintDialog.className = "game-hint-dialog";
  hintDialog.hidden = true;
  hintDialog.innerHTML = `
    <button class="game-hint-dialog__backdrop" type="button" data-close-hint aria-label="ヒントを閉じる"></button>
    <div class="game-hint-dialog__window" role="dialog" aria-modal="true" aria-labelledby="game-hint-title" aria-describedby="game-hint-description">
      <header>
        <div><small>COMMON SUPPORT ARCHIVE</small><h2 id="game-hint-title">ヒント一覧</h2></div>
        <button type="button" data-close-hint aria-label="ヒントを閉じる">×</button>
      </header>
      <div class="game-hint-dialog__content" id="game-hint-description" tabindex="0">
        <p class="game-hint-dialog__status"><i aria-hidden="true"></i> HINT TERMINAL</p>
      </div>
      <footer><button type="button" data-close-hint><span>ゲームに戻る</span><i aria-hidden="true">←</i></button></footer>
    </div>
  `;
  document.body.append(hintDialog);

  const resetDialog = document.createElement("section");
  resetDialog.className = "game-reset-dialog";
  resetDialog.hidden = true;
  resetDialog.innerHTML = `
    <button class="game-reset-dialog__backdrop" type="button" data-cancel-reset aria-label="リセットをキャンセル"></button>
    <div class="game-reset-dialog__window" role="alertdialog" aria-modal="true" aria-labelledby="game-reset-title" aria-describedby="game-reset-description">
      <small>RESET PROGRESS</small>
      <h2 id="game-reset-title">最初から遊びますか？</h2>
      <p id="game-reset-description">これまでの進行状況と、各画面で保存された操作状態がすべてリセットされます。</p>
      <div>
        <button type="button" data-cancel-reset>キャンセル</button>
        <button class="game-reset-dialog__confirm" type="button" data-confirm-reset>リセットする</button>
      </div>
    </div>
  `;
  document.body.append(resetDialog);

  const initialCollisionMinutes = collisionMinutesByProgress[state.maxScreen];
  let trajectorySimulator = null;
  let trajectoryLaunchButton = null;
  if (initialCollisionMinutes) {
    trajectoryLaunchButton = document.createElement("button");
    trajectoryLaunchButton.className = "trajectory-launch";
    trajectoryLaunchButton.type = "button";
    trajectoryLaunchButton.setAttribute("aria-haspopup", "dialog");
    trajectoryLaunchButton.setAttribute("aria-controls", "trajectory-simulator");
    trajectoryLaunchButton.innerHTML = '<i aria-hidden="true">◎</i><span>軌道予測</span>';
    document.body.classList.add("has-trajectory-launch");
    if (document.querySelector(".inventory-launch")) document.body.classList.add("has-trajectory-inventory");
    document.body.append(trajectoryLaunchButton);

    trajectorySimulator = document.createElement("section");
    trajectorySimulator.className = "trajectory-simulator";
    trajectorySimulator.id = "trajectory-simulator";
    trajectorySimulator.hidden = true;
    trajectorySimulator.innerHTML = `
      <button class="trajectory-simulator__backdrop" type="button" data-close-trajectory aria-label="軌道予測を閉じる"></button>
      <div class="trajectory-simulator__window" role="dialog" aria-modal="true" aria-labelledby="trajectory-title" aria-describedby="trajectory-guide">
        <header class="trajectory-simulator__header">
          <div><small>ORBITAL TIME SIMULATOR</small><h2 id="trajectory-title">地球・隕石 軌道予測</h2></div>
          <button type="button" data-close-trajectory aria-label="閉じる">×</button>
        </header>
        <div class="trajectory-simulator__readout">
          <div><span>現在から</span><strong data-trajectory-time>0<small>分後</small></strong></div>
          <p data-trajectory-status><i></i><span>衝突まで ${initialCollisionMinutes}分</span></p>
        </div>
        <div class="trajectory-simulator__stage" data-trajectory-stage>
          <svg viewBox="0 0 1000 560" preserveAspectRatio="xMidYMin meet" role="img" aria-labelledby="trajectory-map-title trajectory-map-desc">
            <title id="trajectory-map-title">地球と隕石の軌道予測図</title>
            <desc id="trajectory-map-desc">地球は左から右、隕石は上から下へ、10分でグリッド1マス移動します。</desc>
            <defs><pattern id="trajectory-grid" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M100 0H0V100" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="8 8"/></pattern></defs>
            <rect class="trajectory-grid" width="1000" height="560" fill="url(#trajectory-grid)"/>
            <line class="trajectory-track trajectory-track--earth" x1="0" y1="360" x2="1000" y2="360"/>
            <line class="trajectory-track trajectory-track--asteroid" x1="750" y1="0" x2="750" y2="560"/>
            <g class="trajectory-earth" data-trajectory-earth tabindex="0" role="slider" aria-label="地球の時間位置" aria-valuemin="0" aria-valuemax="${initialCollisionMinutes + 20}" aria-valuenow="0" aria-valuetext="現在から0分後">
              <circle data-earth-body cx="${750 - initialCollisionMinutes * 10}" cy="360" r="100"/>
              <circle class="trajectory-earth__handle" data-earth-handle cx="${750 - initialCollisionMinutes * 10}" cy="360" r="19"/>
              <text data-earth-label x="${750 - initialCollisionMinutes * 10}" y="220" text-anchor="middle">地球</text>
            </g>
            <g class="trajectory-asteroid" data-trajectory-asteroid>
              <circle data-asteroid-glow cx="750" cy="${260 - initialCollisionMinutes * 10}" r="22"/>
              <circle data-asteroid-body cx="750" cy="${260 - initialCollisionMinutes * 10}" r="12"/>
              <text data-asteroid-label x="780" y="${250 - initialCollisionMinutes * 10}">隕石</text>
            </g>
          </svg>
          <div class="trajectory-simulator__impact" data-trajectory-impact hidden><b>WARNING</b><span>隕石が地球に接触</span></div>
        </div>
        <div class="trajectory-simulator__controls">
          <button type="button" data-trajectory-step="-1" aria-label="1分戻す">−</button>
          <input data-trajectory-range type="range" min="0" max="${initialCollisionMinutes + 20}" step="1" value="0" aria-label="現在から何分後か">
          <button type="button" data-trajectory-step="1" aria-label="1分進める">＋</button>
          <button class="trajectory-simulator__reset" type="button" data-trajectory-reset>現在位置に戻す</button>
        </div>
        <p class="trajectory-simulator__guide" id="trajectory-guide"><i aria-hidden="true">↔</i><span>地球を左右にドラッグしてください</span><small>1目盛り＝1分 ／ グリッド1マス＝10分</small></p>
      </div>
    `;
    document.body.append(trajectorySimulator);
  }

  const menuButton = progress.querySelector(".game-progress__menu-button");
  const menuPanel = progress.querySelector(".game-progress__menu-panel");
  const hintButton = progress.querySelector("[data-open-hint]");
  const hintWindow = hintDialog.querySelector(".game-hint-dialog__window");
  const hintTitle = hintDialog.querySelector("#game-hint-title");
  const hintContent = hintDialog.querySelector(".game-hint-dialog__content");
  const hintPath = [hintTree];
  const cancelResetButton = resetDialog.querySelector(".game-reset-dialog__window [data-cancel-reset]");

  if (trajectorySimulator) {
    const simulatorButton = trajectoryLaunchButton;
    const simulatorWindow = trajectorySimulator.querySelector(".trajectory-simulator__window");
    const stage = trajectorySimulator.querySelector("[data-trajectory-stage]");
    const earth = trajectorySimulator.querySelector("[data-trajectory-earth]");
    const earthBody = trajectorySimulator.querySelector("[data-earth-body]");
    const earthHandle = trajectorySimulator.querySelector("[data-earth-handle]");
    const earthLabel = trajectorySimulator.querySelector("[data-earth-label]");
    const asteroidBody = trajectorySimulator.querySelector("[data-asteroid-body]");
    const asteroidGlow = trajectorySimulator.querySelector("[data-asteroid-glow]");
    const asteroidLabel = trajectorySimulator.querySelector("[data-asteroid-label]");
    const timeReadout = trajectorySimulator.querySelector("[data-trajectory-time]");
    const statusReadout = trajectorySimulator.querySelector("[data-trajectory-status]");
    const impactAlert = trajectorySimulator.querySelector("[data-trajectory-impact]");
    const range = trajectorySimulator.querySelector("[data-trajectory-range]");
    const maxFuture = initialCollisionMinutes + 20;
    let futureMinutes = 0;
    let wasColliding = false;
    let pointerId = null;

    function playImpactAlert() {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const audio = new AudioContextClass();
        [0, .16].forEach((delay, index) => {
          const oscillator = audio.createOscillator();
          const gain = audio.createGain();
          oscillator.type = "square";
          oscillator.frequency.value = index ? 520 : 390;
          gain.gain.setValueAtTime(.045, audio.currentTime + delay);
          gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + delay + .12);
          oscillator.connect(gain).connect(audio.destination);
          oscillator.start(audio.currentTime + delay);
          oscillator.stop(audio.currentTime + delay + .13);
        });
        window.setTimeout(() => audio.close(), 500);
      } catch { /* sound is an optional enhancement */ }
    }

    function setFutureMinutes(value, announceImpact = true) {
      futureMinutes = Math.max(0, Math.min(maxFuture, Math.round(Number(value) || 0)));
      const earthX = 750 - initialCollisionMinutes * 10 + futureMinutes * 10;
      const asteroidY = 260 - initialCollisionMinutes * 10 + futureMinutes * 10;
      const relativeX = earthX - 750;
      const relativeY = 360 - asteroidY;
      const distance = Math.hypot(relativeX, relativeY);
      const isEntryContact = futureMinutes === initialCollisionMinutes;
      const colliding = isEntryContact || (futureMinutes > initialCollisionMinutes && distance < 99.99);
      const hasPassed = futureMinutes > initialCollisionMinutes && !colliding;
      const untilCollision = initialCollisionMinutes - futureMinutes;

      [earthBody, earthHandle].forEach(node => node.setAttribute("cx", String(earthX)));
      earthLabel.setAttribute("x", String(earthX));
      [asteroidBody, asteroidGlow].forEach(node => node.setAttribute("cy", String(asteroidY)));
      asteroidLabel.setAttribute("y", String(asteroidY - 10));
      timeReadout.innerHTML = `${futureMinutes}<small>分後</small>`;
      range.value = String(futureMinutes);
      earth.setAttribute("aria-valuenow", String(futureMinutes));
      earth.setAttribute("aria-valuetext", `現在から${futureMinutes}分後`);

      trajectorySimulator.classList.toggle("is-danger", colliding);
      trajectorySimulator.classList.toggle("is-passed", hasPassed);
      impactAlert.hidden = !colliding;
      if (futureMinutes < initialCollisionMinutes) {
        statusReadout.innerHTML = `<i></i><span>衝突まで ${untilCollision}分</span>`;
      } else if (colliding && futureMinutes === initialCollisionMinutes) {
        statusReadout.innerHTML = "<i></i><span>衝突開始</span>";
      } else if (colliding) {
        statusReadout.innerHTML = "<i></i><span>隕石が地球内部を通過中</span>";
      } else {
        statusReadout.innerHTML = "<i></i><span>隕石が地球を通過</span>";
      }
      if (colliding && !wasColliding && announceImpact) playImpactAlert();
      wasColliding = colliding;
    }

    function setFromPointer(clientX) {
      const svg = stage.querySelector("svg");
      const rect = svg.getBoundingClientRect();
      const viewX = (clientX - rect.left) / rect.width * 1000;
      const initialEarthX = 750 - initialCollisionMinutes * 10;
      setFutureMinutes((viewX - initialEarthX) / 10);
    }

    earth.addEventListener("pointerdown", event => {
      pointerId = event.pointerId;
      earth.setPointerCapture(pointerId);
      earth.classList.add("is-dragging");
      setFromPointer(event.clientX);
      event.preventDefault();
    });
    earth.addEventListener("pointermove", event => {
      if (event.pointerId !== pointerId) return;
      setFromPointer(event.clientX);
    });
    function endDrag(event) {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      earth.classList.remove("is-dragging");
    }
    earth.addEventListener("pointerup", endDrag);
    earth.addEventListener("pointercancel", endDrag);
    earth.addEventListener("keydown", event => {
      const delta = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 0;
      if (delta) { event.preventDefault(); setFutureMinutes(futureMinutes + delta); }
      else if (event.key === "Home") { event.preventDefault(); setFutureMinutes(0); }
      else if (event.key === "End") { event.preventDefault(); setFutureMinutes(maxFuture); }
    });
    range.addEventListener("input", () => setFutureMinutes(range.value));
    trajectorySimulator.querySelectorAll("[data-trajectory-step]").forEach(button => button.addEventListener("click", () => setFutureMinutes(futureMinutes + Number(button.dataset.trajectoryStep))));
    trajectorySimulator.querySelector("[data-trajectory-reset]").addEventListener("click", () => setFutureMinutes(0));

    function openTrajectorySimulator() {
      closeMenu();
      trajectorySimulator.hidden = false;
      document.body.classList.add("has-open-simulator");
      setFutureMinutes(0, false);
      trajectorySimulator.querySelector("[data-close-trajectory]:not(.trajectory-simulator__backdrop)").focus();
    }
    function closeTrajectorySimulator() {
      trajectorySimulator.hidden = true;
      document.body.classList.remove("has-open-simulator");
      simulatorButton.focus();
    }
    simulatorButton.addEventListener("click", openTrajectorySimulator);
    trajectorySimulator.querySelectorAll("[data-close-trajectory]").forEach(button => button.addEventListener("click", closeTrajectorySimulator));
    simulatorWindow.addEventListener("keydown", event => {
      if (event.key === "Escape") closeTrajectorySimulator();
    });
    setFutureMinutes(0, false);
  }

  function closeMenu() {
    menuPanel.hidden = true;
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "メニューを開く");
  }

  function renderHintNode() {
    const node = hintPath[hintPath.length - 1];
    const breadcrumbs = hintPath.map(item => item.title).join(" / ");
    hintTitle.textContent = node.title;
    hintContent.innerHTML = `
      <p class="game-hint-dialog__status"><i aria-hidden="true"></i> HINT TERMINAL</p>
      <nav class="game-hint-dialog__breadcrumb" aria-label="現在のヒント階層">${breadcrumbs}</nav>
      <section class="game-hint-dialog__node game-hint-dialog__node--${node.type}">
        <span>${node.type === "answer" ? "ANSWER DATA" : "SUPPORT DATA"}</span>
        <h3>${node.title}</h3>
        <p>${node.content}</p>
        ${node.image ? `<img class="game-hint-dialog__media" src="${node.image}" alt="${node.imageAlt || ""}" loading="lazy">` : ""}
      </section>
      ${node.children.length ? `<div class="game-hint-dialog__items">${node.children.map((child, index) => `
        <button type="button" data-hint-child="${index}">
          <span><small>${child.type === "answer" ? "ANSWER" : child.type === "hint" ? "HINT" : "CATEGORY"}</small><b>${child.title}</b></span>
          <i aria-hidden="true">→</i>
        </button>`).join("")}</div>` : ""}
      ${hintPath.length > 1 ? `<div class="game-hint-dialog__nav-actions">
        <button class="game-hint-dialog__back" type="button" data-hint-back><i aria-hidden="true">←</i><span>ひとつ前に戻る</span></button>
        ${node.type === "hint" || node.type === "answer" ? `
          <button class="game-hint-dialog__back" type="button" data-hint-category><i aria-hidden="true">↖</i><span>カテゴリ選択に戻る</span></button>
          <button class="game-hint-dialog__back" type="button" data-hint-topic><i aria-hidden="true">↰</i><span>項目選択に戻る</span></button>
        ` : ""}
      </div>` : ""}
    `;
    hintContent.scrollTop = 0;
  }

  function openHintDialog() {
    closeMenu();
    hintPath.splice(1);
    renderHintNode();
    hintDialog.hidden = false;
    document.body.classList.add("has-open-hint");
    hintDialog.querySelector("header [data-close-hint]").focus();
  }

  function closeHintDialog() {
    if (hintDialog.hidden) return;
    hintDialog.hidden = true;
    document.body.classList.remove("has-open-hint");
    menuButton.focus();
  }

  function closeResetDialog() {
    resetDialog.hidden = true;
    menuButton.focus();
  }

  menuButton.addEventListener("click", () => {
    const willOpen = menuPanel.hidden;
    menuPanel.hidden = !willOpen;
    menuButton.setAttribute("aria-expanded", String(willOpen));
    menuButton.setAttribute("aria-label", willOpen ? "メニューを閉じる" : "メニューを開く");
  });

  hintButton.addEventListener("click", openHintDialog);
  hintContent.addEventListener("click", event => {
    const childButton = event.target.closest("[data-hint-child]");
    if (childButton) {
      const node = hintPath[hintPath.length - 1];
      const child = node.children[Number(childButton.dataset.hintChild)];
      if (!child) return;
      hintPath.push(child);
      renderHintNode();
      hintContent.focus({ preventScroll: true });
      return;
    }
    if (event.target.closest("[data-hint-category]") && hintPath.length > 1) {
      hintPath.splice(1);
      renderHintNode();
      hintContent.focus({ preventScroll: true });
      return;
    }
    if (event.target.closest("[data-hint-topic]") && hintPath.length > 2) {
      hintPath.splice(2);
      renderHintNode();
      hintContent.focus({ preventScroll: true });
      return;
    }
    if (event.target.closest("[data-hint-back]") && hintPath.length > 1) {
      hintPath.pop();
      renderHintNode();
      hintContent.focus({ preventScroll: true });
    }
  });
  hintDialog.querySelectorAll("[data-close-hint]").forEach(button => button.addEventListener("click", closeHintDialog));
  hintWindow.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;
    const focusable = [...hintWindow.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),[tabindex]:not([tabindex="-1"])')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  progress.querySelector("[data-open-reset-dialog]").addEventListener("click", () => {
    closeMenu();
    resetDialog.hidden = false;
    cancelResetButton.focus();
  });
  resetDialog.querySelectorAll("[data-cancel-reset]").forEach(button => button.addEventListener("click", closeResetDialog));
  resetDialog.querySelector("[data-confirm-reset]").addEventListener("click", resetProgress);
  document.addEventListener("click", event => {
    if (!progress.querySelector(".game-progress__menu").contains(event.target)) closeMenu();
  });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    if (!hintDialog.hidden) closeHintDialog();
    else if (!resetDialog.hidden) closeResetDialog();
    else closeMenu();
  });
})();
