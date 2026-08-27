// ==========================================
// CLIENT STATE & INITIALIZATION
// ==========================================

const socket = io();

let currentRoomCode = null;
let myPlayerId = null;
let isHost = false;
let mySeatIndex = -1;
let lastGameState = null;
let soundEnabled = true;
let audioCtx = null;
let unreadLogCount = 0;
let currentLang = localStorage.getItem('poker_lang') || 'en';

// ==========================================
// INTERNATIONALIZATION (i18n) DICTIONARY
// ==========================================

const TRANSLATIONS = {
  en: {
    lang_btn: '🌐 العربية',
    creator_title: "ISHAK EL-9AMARDJII",
    brand_title: "ROYAL HOLD'EM",
    brand_subtitle: "Real-Time Multiplayer Texas Hold'em Poker",
    tab_join: "Join Room",
    tab_create: "Create Room",
    join_name_label: "Your Display Name",
    join_name_placeholder: "Enter your nickname",
    join_code_label: "Room Code",
    join_code_placeholder: "e.g. A9B2X7",
    btn_join_table: "Join Table",
    create_name_label: "Your Display Name",
    create_name_placeholder: "Enter your nickname",
    starting_chips_label: "Starting Chips ($)",
    max_seats_label: "Max Players (2 - 20)",
    small_blind_label: "Small Blind ($ - Auto Half)",
    big_blind_label: "Big Blind ($)",
    turn_timer_label: "Turn Timer (Seconds, 0 = Unlimited)",
    hand_helper_label: "Show Hand Name Helper (e.g. Two Pair, Flush)",
    btn_create_room: "Create Private Room",
    hand_rankings_guide_link: "📖 Hand Rankings Guide / دليل ترتيب أيدي البوكر",
    
    // Game Header
    room_label: "ROOM",
    share_link_btn: "🔗 Share",
    btn_rankings: "🃏 Rankings",
    btn_settings: "⚙️ Settings",
    btn_leave: "Leave",
    hand_prefix: "Hand #",

    // Stages
    stage_waiting: "WAITING",
    stage_preflop: "PREFLOP",
    stage_flop: "FLOP",
    stage_turn: "TURN",
    stage_river: "RIVER",
    stage_showdown: "SHOWDOWN",
    stage_hand_ended: "HAND ENDED",

    // Table Felt
    total_pot: "TOTAL POT",
    current_hand_prefix: "Current Hand:",
    sit_btn: "+ Sit",
    folded: "Folded",
    all_in: "All-In",
    away: "Away",
    reload_player_btn: "+ 💰 Reload",
    
    // Actions
    btn_fold: "FOLD",
    btn_fold_sub: "Forfeit hand",
    btn_check: "CHECK",
    btn_check_sub: "Pass action",
    btn_call: "CALL",
    btn_allin: "ALL-IN",
    btn_bet: "BET",
    btn_raise: "RAISE TO",
    
    // Status & Host controls
    waiting_for_host: "Waiting for host to start the game...",
    waiting_for_seats: "Waiting for at least 2 players to sit down...",
    table_ready_host: "Table ready! Click Start when all players are ready.",
    waiting_host_start: "Waiting for host to start hand...",
    waiting_player_turn: "Waiting for {name} to act...",
    creator_ready_reveal: "👑 <strong>You are the Room Creator</strong>: Ready to reveal!",
    creator_waiting_prompt: "⏳ Waiting for room creator to {action}...",
    hand_finished_host: "👑 <strong>Hand Finished!</strong> Click below when ready for next hand.",
    btn_start_next_hand: "🎮 Start Next Hand",
    btn_start_hand: "🎮 Start Hand Now",
    btn_deal_next: "👉 {label}",
    deal_flop: "Deal Flop (3 Cards)",
    deal_turn: "Deal Turn Card",
    deal_river: "Deal River Card",
    reveal_winner: "Reveal Winner & Showdown",
    start_next_hand: "Start Next Hand",
    btn_reload_table: "Reload Table",
    out_of_chips_warning: "⚠️ <strong>Out of Chips!</strong> Ask the room creator to reload your chips.",
    
    // Settings Modal
    settings_title: "⚙️ Table & Game Settings",
    settings_turn_time: "Turn Time (Seconds, 0 = Unlimited)",
    settings_max_players: "Max Players (2 - 20)",
    settings_sb: "Small Blind ($ - Auto Half)",
    settings_bb: "Big Blind ($)",
    settings_chips: "Starting / Reload Chips ($)",
    settings_helper: "Tell player the name of their hand (e.g. Flush, Full House)",
    settings_host_notice: "★ You are the Host. Changes apply immediately to the table.",
    settings_guest_notice: "Only the table Host can modify these settings.",
    btn_save_settings: "Save Table Settings",

    // Drawer
    tab_log: "Table Log",
    tab_chat: "Chat",
    chat_placeholder: "Type a message...",
    btn_send: "Send",

    // Modals & Toasts
    rankings_modal_title: "🃏 دليل ترتيب أيدي البوكر (Hand Rankings)",
    tab_chart: "🖼️ الصورة (Chart)",
    tab_arabic_list: "📝 القائمة بالعربية",
    btn_close_return: "✓ Close & Return to Game",
    confirm_leave: "Are you sure you want to leave the table?",
    confirm_reload_table: "Are you sure you want to reload ${amount} chips for all bankrupt players at the table?",
    confirm_reload_player: "Are you sure you want to reload ${amount} chips for {name}?",
    toast_reloaded_table: "Reloaded ${amount} chips for table!",
    toast_reloaded_player: "Reloaded ${amount} chips for {name}!",
    toast_copied_code: "Copied room code: {code}",
    toast_copied_link: "Invite link copied to clipboard!",
    toast_sound_on: "Sound Unmuted",
    toast_sound_off: "Sound Muted"
  },
  ar: {
    lang_btn: '🌐 English',
    creator_title: "إسحاق القمارجي",
    brand_title: "رويال هولدم",
    brand_subtitle: "لعبة تكساس هولدم بوكر متعددة اللاعبين مباشرة",
    tab_join: "الانضمام لغرفة",
    tab_create: "إنشاء غرفة جديدة",
    join_name_label: "اسمك في اللعبة",
    join_name_placeholder: "أدخل اسمك أو لقبك",
    join_code_label: "رمز الغرفة",
    join_code_placeholder: "مثال: A9B2X7",
    btn_join_table: "دخول الطاولة",
    create_name_label: "اسمك في اللعبة",
    create_name_placeholder: "أدخل اسمك أو لقبك",
    starting_chips_label: "فيشات البدء ($)",
    max_seats_label: "عدد اللاعبين (2 - 20)",
    small_blind_label: "السمول بلايند ($ - تلقائياً النصف)",
    big_blind_label: "البيغ بلايند ($)",
    turn_timer_label: "وقت التفكير للدور (بالثواني، 0 = بدون وقت)",
    hand_helper_label: "إظهار اسم ومستوى اليد (مثال: Two Pair, Flush)",
    btn_create_room: "إنشاء طاولة خاصة",
    hand_rankings_guide_link: "📖 دليل ترتيب أيدي البوكر (Hand Rankings)",
    
    // Game Header
    room_label: "الغرفة",
    share_link_btn: "🔗 مشاركة",
    btn_rankings: "🃏 الترتيب",
    btn_settings: "⚙️ الإعدادات",
    btn_leave: "خروج",
    hand_prefix: "اليد #",

    // Stages
    stage_waiting: "في الانتظار",
    stage_preflop: "قبل الفلوب (Preflop)",
    stage_flop: "الفلوب (Flop)",
    stage_turn: "التيرن (Turn)",
    stage_river: "الريفر (River)",
    stage_showdown: "المواجهة (Showdown)",
    stage_hand_ended: "انتهت اليد",

    // Table Felt
    total_pot: "إجمالي الـ POT",
    current_hand_prefix: "يدك الحالية:",
    sit_btn: "+ جلوس",
    folded: "منسحب",
    all_in: "أول إن (All-In)",
    away: "غير متصل",
    reload_player_btn: "+ 💰 شحن",
    
    // Actions
    btn_fold: "انسحاب (FOLD)",
    btn_fold_sub: "الانسحاب من اليد",
    btn_check: "تمرير (CHECK)",
    btn_check_sub: "تمرير الدور",
    btn_call: "مطابقة (CALL)",
    btn_allin: "الكل (ALL-IN)",
    btn_bet: "مراهنة (BET)",
    btn_raise: "زيادة إلى (RAISE)",
    
    // Status & Host controls
    waiting_for_host: "في انتظار صانع الغرفة لبدء اللعبة...",
    waiting_for_seats: "في انتظار جلوس لاعبين اثنين على الأقل...",
    table_ready_host: "الطاولة جاهزة! اضغط بدء عندما يكتمل اللاعبون.",
    waiting_host_start: "في انتظار صانع الغرفة لبدء اليد...",
    waiting_player_turn: "في انتظار دور {name}...",
    creator_ready_reveal: "👑 <strong>أنت صانع الغرفة</strong>: جاهز للكشف!",
    creator_waiting_prompt: "⏳ في انتظار صانع الغرفة لـ {action}...",
    hand_finished_host: "👑 <strong>انتهت اليد!</strong> اضغط بالأسفل عندما تكون جاهزاً لليد التالية.",
    btn_start_next_hand: "🎮 بدء اليد التالية",
    btn_start_hand: "🎮 بدء اللعب الآن",
    btn_deal_next: "👉 {label}",
    deal_flop: "توزيع الفلوب (3 بطاقات)",
    deal_turn: "توزيع بطاقة التيرن",
    deal_river: "توزيع بطاقة الريفر",
    reveal_winner: "كشف الفائز والمواجهة",
    start_next_hand: "بدء اليد التالية",
    btn_reload_table: "شحن الطاولة",
    out_of_chips_warning: "⚠️ <strong>نفدت فيشاتك!</strong> اطلب من صانع الغرفة شحن رصيدك.",
    
    // Settings Modal
    settings_title: "⚙️ إعدادات الطاولة واللعبة",
    settings_turn_time: "وقت التفكير للدور (بالثواني، 0 = غير محدود)",
    settings_max_players: "عدد اللاعبين (2 - 20)",
    settings_sb: "السمول بلايند ($ - تلقائياً النصف)",
    settings_bb: "البيغ بلايند ($)",
    settings_chips: "فيشات البدء / إعادة الشحن ($)",
    settings_helper: "إخبار اللاعب باسم تركيبة يده (مثال: فل هاوس، فلاش)",
    settings_host_notice: "★ أنت صانع الطاولة. التغييرات تطبق فوراً على الطاولة.",
    settings_guest_notice: "صانع الطاولة فقط يستطيع تعديل هذه الإعدادات.",
    btn_save_settings: "حفظ إعدادات الطاولة",

    // Drawer
    tab_log: "سجل الطاولة",
    tab_chat: "الدردشة",
    chat_placeholder: "اكتب رسالة...",
    btn_send: "إرسال",

    // Modals & Toasts
    rankings_modal_title: "🃏 دليل ترتيب أيدي البوكر",
    tab_chart: "🖼️ صورة الترتيب",
    tab_arabic_list: "📝 القائمة بالعربية",
    btn_close_return: "✓ إغلاق والعودة للعبة",
    confirm_leave: "هل أنت متأكد من مغادرة الطاولة؟",
    confirm_reload_table: "هل أنت متأكد من رغبتك في شحن {amount}$ لجميع اللاعبين المفلسين على الطاولة؟",
    confirm_reload_player: "هل أنت متأكد من رغبتك في شحن {amount}$ للاعب {name}؟",
    toast_reloaded_table: "تم شحن {amount}$ لجميع اللاعبين على الطاولة!",
    toast_reloaded_player: "تم شحن {amount}$ للاعب {name}!",
    toast_copied_code: "تم نسخ رمز الغرفة: {code}",
    toast_copied_link: "تم نسخ رابط الدعوة إلى الحافظة!",
    toast_sound_on: "تم تفعيل الصوت",
    toast_sound_off: "تم كتم الصوت"
  }
};

function t(key, params = {}) {
  const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  let text = dict[key] || TRANSLATIONS.en[key] || key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  return text;
}

function translateStage(stage) {
  if (!stage) return '';
  const key = `stage_${stage.toLowerCase()}`;
  return t(key) || stage.replace('_', ' ').toUpperCase();
}

function translateAction(action) {
  if (!action) return '';
  if (currentLang !== 'ar') return action;
  
  if (action === 'fold') return 'انسحاب (Fold)';
  if (action === 'check') return 'تمرير (Check)';
  if (action === 'call') return 'مطابقة (Call)';
  if (action === 'raise') return 'زيادة (Raise)';
  if (action === 'bet') return 'مراهنة (Bet)';
  if (action.startsWith('Called')) return action.replace('Called', 'مطابقة');
  if (action.startsWith('Raised to')) return action.replace('Raised to', 'زيادة إلى');
  if (action.startsWith('Bet')) return action.replace('Bet', 'مراهنة');
  if (action.startsWith('All-in')) return action.replace('All-in', 'أول إن');
  if (action.startsWith('Small Blind')) return action.replace('Small Blind', 'سمول بلايند');
  if (action.startsWith('Big Blind')) return action.replace('Big Blind', 'بيغ بلايند');
  if (action === 'Checked') return 'تمرير';
  if (action === 'Folded') return 'منسحب';
  if (action === 'All-In') return 'أول إن';
  return action;
}

function translateHandDescription(desc) {
  if (!desc || currentLang !== 'ar') return desc;
  return desc
    .replace(/Royal Flush/gi, 'رويال فلاش (Royal Flush)')
    .replace(/Straight Flush/gi, 'ستريت فلاش (Straight Flush)')
    .replace(/Four of a Kind/gi, 'فور أوف كايند (Four of a Kind)')
    .replace(/Full House/gi, 'فول هاوس (Full House)')
    .replace(/Flush/gi, 'فلاش (Flush)')
    .replace(/Straight/gi, 'ستريت (Straight)')
    .replace(/Three of a Kind/gi, 'ثري أوف كايند (Three of a Kind)')
    .replace(/Two Pair/gi, 'تو بير (Two Pair)')
    .replace(/One Pair/gi, 'ون بير (One Pair)')
    .replace(/Pair of/gi, 'زوج من')
    .replace(/High Card/gi, 'هاي كارد (High Card)')
    .replace(/All other players folded/gi, 'انسحاب جميع اللاعبين الآخرين')
    .replace(/Won by Fold/gi, 'فوز بالانسحاب');
}

function translateLogMessage(text) {
  if (!text || currentLang !== 'ar') return text;
  return text
    .replace(/--- Starting Hand #(\d+) ---/g, '--- بدء اليد رقم #$1 ---')
    .replace(/posts Small Blind \$(\d+)/g, 'دفع السمول بلايند $$1')
    .replace(/posts Big Blind \$(\d+)/g, 'دفع البيغ بلايند $$1')
    .replace(/calls \$(\d+)/g, 'طابق $$1')
    .replace(/raises to \$(\d+)/g, 'رفع الرهان إلى $$1')
    .replace(/bets \$(\d+)/g, 'راهن بمبلغ $$1')
    .replace(/checks/g, 'مرر الدور')
    .replace(/folds/g, 'انسحب')
    .replace(/goes ALL-IN for \$(\d+)/g, 'دخل ALL-IN بكامل رصيده $$1')
    .replace(/Flop dealt:/g, 'توزيع الفلوب:')
    .replace(/Turn dealt:/g, 'توزيع التيرن:')
    .replace(/River dealt:/g, 'توزيع الريفر:')
    .replace(/🏆 (.*) won \$([\d,]+) with (.*)!/g, (m, name, amt, hand) => `🏆 ${name} فاز بمبلغ $${amt} بـ ${translateHandDescription(hand)}!`)
    .replace(/🏆 (.*) won \$([\d,]+) \(all others folded\)\./g, (m, name, amt) => `🏆 ${name} فاز بمبلغ $${amt} (انسحاب باقي اللاعبين).`)
    .replace(/🤝 Split pot between (.*) with (.*)!/g, (m, names, hand) => `🤝 تقسيم الوعاء بالتساوي بين ${names} بـ ${translateHandDescription(hand)}!`)
    .replace(/Game paused: Not enough players with chips/g, 'توقفت اللعبة: لا يوجد عدد كافٍ من اللاعبين أصحاب الرصيد');
}

function applyTranslations() {
  document.documentElement.lang = currentLang;
  if (currentLang === 'ar') {
    document.body.classList.add('lang-ar');
  } else {
    document.body.classList.remove('lang-ar');
  }

  // Update Language Toggle Buttons
  const lobbyLangBtn = document.getElementById('lobby-lang-btn');
  const gameLangBtn = document.getElementById('game-lang-btn');
  const langText = t('lang_btn');
  if (lobbyLangBtn) lobbyLangBtn.textContent = langText;
  if (gameLangBtn) gameLangBtn.textContent = langText;

  // Lobby Elements
  const creatorTag = document.getElementById('i18n-creator-tag');
  const tableCreatorTag = document.getElementById('i18n-table-creator-tag');
  const brandTitle = document.getElementById('i18n-brand-title');
  const brandSubtitle = document.getElementById('i18n-brand-subtitle');

  if (creatorTag) creatorTag.textContent = t('creator_title');
  if (tableCreatorTag) tableCreatorTag.textContent = t('creator_title');
  const tabJoin = document.getElementById('tab-join');
  const tabCreate = document.getElementById('tab-create');
  const lblJoinName = document.getElementById('lbl-join-name');
  const joinNameInput = document.getElementById('join-name');
  const lblJoinCode = document.getElementById('lbl-join-code');
  const joinCodeInput = document.getElementById('join-code');
  const btnJoinText = document.getElementById('btn-join-text');
  const lblCreateName = document.getElementById('lbl-create-name');
  const createNameInput = document.getElementById('create-name');
  const lblStartingChips = document.getElementById('lbl-starting-chips');
  const lblMaxSeats = document.getElementById('lbl-max-seats');
  const lblSmallBlind = document.getElementById('lbl-small-blind');
  const lblBigBlind = document.getElementById('lbl-big-blind');
  const lblTurnTimer = document.getElementById('lbl-turn-timer');
  const lblShowHandHelper = document.getElementById('lbl-show-hand-helper');
  const btnCreateText = document.getElementById('btn-create-text');
  const btnLobbyRankings = document.getElementById('btn-lobby-rankings');

  if (brandTitle) brandTitle.textContent = t('brand_title');
  if (brandSubtitle) brandSubtitle.textContent = t('brand_subtitle');
  if (tabJoin) tabJoin.textContent = t('tab_join');
  if (tabCreate) tabCreate.textContent = t('tab_create');
  if (lblJoinName) lblJoinName.textContent = t('join_name_label');
  if (joinNameInput) joinNameInput.placeholder = t('join_name_placeholder');
  if (lblJoinCode) lblJoinCode.textContent = t('join_code_label');
  if (joinCodeInput) joinCodeInput.placeholder = t('join_code_placeholder');
  if (btnJoinText) btnJoinText.textContent = t('btn_join_table');
  if (lblCreateName) lblCreateName.textContent = t('create_name_label');
  if (createNameInput) createNameInput.placeholder = t('create_name_placeholder');
  if (lblStartingChips) lblStartingChips.textContent = t('starting_chips_label');
  if (lblMaxSeats) lblMaxSeats.textContent = t('max_seats_label');
  if (lblSmallBlind) lblSmallBlind.textContent = t('small_blind_label');
  if (lblBigBlind) lblBigBlind.textContent = t('big_blind_label');
  if (lblTurnTimer) lblTurnTimer.textContent = t('turn_timer_label');
  if (lblShowHandHelper) lblShowHandHelper.textContent = t('hand_helper_label');
  if (btnCreateText) btnCreateText.textContent = t('btn_create_room');
  if (btnLobbyRankings) btnLobbyRankings.textContent = t('hand_rankings_guide_link');

  // Game Header Elements
  const badgeRoomLabel = document.getElementById('badge-room-label');
  const btnShareLinkText = document.getElementById('btn-share-link-text');
  const btnOpenRankings = document.getElementById('btn-open-rankings');
  const btnOpenSettings = document.getElementById('btn-open-settings');
  const btnLeave = document.getElementById('btn-leave');

  if (badgeRoomLabel) badgeRoomLabel.textContent = t('room_label');
  if (btnShareLinkText) btnShareLinkText.textContent = t('share_link_btn');
  if (btnOpenRankings) btnOpenRankings.textContent = t('btn_rankings');
  if (btnOpenSettings) btnOpenSettings.textContent = t('btn_settings');
  if (btnLeave) btnLeave.textContent = t('btn_leave');

  // Table Felt & Controls
  const potLabel = document.querySelector('.pot-label');
  if (potLabel) potLabel.textContent = t('total_pot');
  const myStrengthLabel = document.getElementById('my-hand-strength-label');
  if (myStrengthLabel) myStrengthLabel.textContent = t('current_hand_prefix');

  // Action Buttons
  const btnFoldTitle = document.getElementById('btn-fold-title');
  const btnFoldSub = document.getElementById('btn-fold-sub');
  const btnCheckTitle = document.getElementById('btn-check-title');
  const btnCheckSub = document.getElementById('btn-check-sub');

  if (btnFoldTitle) btnFoldTitle.textContent = t('btn_fold');
  if (btnFoldSub) btnFoldSub.textContent = t('btn_fold_sub');
  if (btnCheckTitle) btnCheckTitle.textContent = t('btn_check');
  if (btnCheckSub) btnCheckSub.textContent = t('btn_check_sub');

  // Drawer
  const tabLog = document.getElementById('tab-log');
  const tabChat = document.getElementById('tab-chat');
  const chatInput = document.getElementById('chat-input');
  const btnChatSend = document.getElementById('btn-chat-send');

  if (tabLog) tabLog.textContent = t('tab_log');
  if (tabChat) tabChat.textContent = t('tab_chat');
  if (chatInput) chatInput.placeholder = t('chat_placeholder');
  if (btnChatSend) btnChatSend.textContent = t('btn_send');

  // Settings Modal
  const settingsTitle = document.getElementById('settings-modal-title');
  const lblSettingTimer = document.getElementById('lbl-setting-turn-timer');
  const lblSettingMaxSeats = document.getElementById('lbl-setting-max-seats');
  const lblSettingSB = document.getElementById('lbl-setting-small-blind');
  const lblSettingBB = document.getElementById('lbl-setting-big-blind');
  const lblSettingChips = document.getElementById('lbl-setting-starting-chips');
  const lblSettingHelper = document.getElementById('lbl-setting-hand-helper');
  const btnSaveSettings = document.getElementById('btn-save-settings');

  if (settingsTitle) settingsTitle.textContent = t('settings_title');
  if (lblSettingTimer) lblSettingTimer.textContent = t('settings_turn_time');
  if (lblSettingMaxSeats) lblSettingMaxSeats.textContent = t('settings_max_players');
  if (lblSettingSB) lblSettingSB.textContent = t('settings_sb');
  if (lblSettingBB) lblSettingBB.textContent = t('settings_bb');
  if (lblSettingChips) lblSettingChips.textContent = t('settings_chips');
  if (lblSettingHelper) lblSettingHelper.textContent = t('settings_helper');
  if (btnSaveSettings) btnSaveSettings.textContent = t('btn_save_settings');

  // Rankings Modal
  const rankingsTitle = document.getElementById('rankings-modal-title');
  const btnTabChart = document.getElementById('btn-tab-chart');
  const btnTabText = document.getElementById('btn-tab-text');
  const btnCloseChart = document.getElementById('btn-close-chart');
  const btnCloseList = document.getElementById('btn-close-list');

  if (rankingsTitle) rankingsTitle.textContent = t('rankings_modal_title');
  if (btnTabChart) btnTabChart.textContent = t('tab_chart');
  if (btnTabText) btnTabText.textContent = t('tab_arabic_list');
  if (btnCloseChart) btnCloseChart.textContent = t('btn_close_return');
  if (btnCloseList) btnCloseList.textContent = t('btn_close_return');

  // Re-render game state if currently active
  if (lastGameState) {
    renderGameState(lastGameState);
  }
}

function toggleLanguage() {
  currentLang = currentLang === 'en' ? 'ar' : 'en';
  localStorage.setItem('poker_lang', currentLang);
  applyTranslations();
  showToast(currentLang === 'ar' ? 'تم تحويل لغة المنصة إلى العربية' : 'Platform language changed to English', 'success');
}

// Initialize session from storage or query params
window.addEventListener('DOMContentLoaded', () => {
  applyTranslations();

  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');

  if (roomParam) {
    document.getElementById('join-code').value = roomParam.toUpperCase();
    switchLobbyTab('join');
  }

  // Attempt auto-reconnect if session exists
  const savedRoom = sessionStorage.getItem('poker_room');
  const savedPlayerId = sessionStorage.getItem('poker_player_id');
  const savedName = sessionStorage.getItem('poker_name');

  if (savedName) {
    document.getElementById('join-name').value = savedName;
    document.getElementById('create-name').value = savedName;
  }

  if (savedRoom && savedPlayerId) {
    showToast('Reconnecting to room ' + savedRoom + '...', 'info');
    socket.emit('reconnect_session', {
      roomCode: savedRoom,
      playerId: savedPlayerId
    });
  }
});

// ==========================================
// SOUND SYNTHESIS (Web Audio API)
// ==========================================

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playSound(type) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    if (type === 'deal') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.08);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'chip') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.06);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } else if (type === 'turn') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.1); // A5
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'win') {
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.1);
        gain.gain.setValueAtTime(0.2, now + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.25);
      });
    } else if (type === 'check') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(200, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    }
  } catch (e) {
    // Audio might be blocked until user gesture
  }
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  const btn = document.getElementById('sound-btn');
  btn.textContent = soundEnabled ? '🔊' : '🔇';
  showToast(soundEnabled ? t('toast_sound_on') : t('toast_sound_off'), 'info');
}

// ==========================================
// TOAST NOTIFICATIONS & MODALS
// ==========================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function openHandRankingsModal() {
  document.getElementById('rankings-modal').classList.remove('hidden');
}

function closeHandRankingsModal() {
  document.getElementById('rankings-modal').classList.add('hidden');
}

function closeModalOnBackdrop(e) {
  if (e.target.id === 'rankings-modal') {
    closeHandRankingsModal();
  }
}

function switchRankingsTab(tab) {
  const btnChart = document.getElementById('btn-tab-chart');
  const btnText = document.getElementById('btn-tab-text');
  const paneChart = document.getElementById('pane-chart');
  const paneText = document.getElementById('pane-text');

  if (tab === 'chart') {
    btnChart.classList.add('active');
    btnText.classList.remove('active');
    paneChart.classList.add('active');
    paneText.classList.remove('active');
  } else {
    btnText.classList.add('active');
    btnChart.classList.remove('active');
    paneText.classList.add('active');
    paneChart.classList.remove('active');
  }
}

// Global Escape Key Listener to Close Modals Immediately
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeHandRankingsModal();
    closeSettingsModal();
  }
});

// Smart Poker Suggestions based on Player Count
function getPokerSuggestions(playerCount) {
  const count = Math.min(Math.max(Number(playerCount) || 6, 2), 20);
  if (count <= 2) {
    return { startingChips: 1000, bigBlind: 20, smallBlind: 10 };
  } else if (count <= 5) {
    return { startingChips: 1500, bigBlind: 30, smallBlind: 15 };
  } else if (count <= 8) {
    return { startingChips: 2000, bigBlind: 40, smallBlind: 20 };
  } else if (count <= 12) {
    return { startingChips: 3000, bigBlind: 60, smallBlind: 30 };
  } else {
    return { startingChips: 5000, bigBlind: 100, smallBlind: 50 };
  }
}

function onMaxPlayersChange(players) {
  const suggestions = getPokerSuggestions(players);
  const startingChipsInput = document.getElementById('starting-chips');
  const bigBlindInput = document.getElementById('big-blind');
  const smallBlindInput = document.getElementById('small-blind');

  if (startingChipsInput) startingChipsInput.value = suggestions.startingChips;
  if (bigBlindInput) bigBlindInput.value = suggestions.bigBlind;
  if (smallBlindInput) smallBlindInput.value = suggestions.smallBlind;
}

function onBigBlindChange(bbValue) {
  const bb = Math.max(2, Number(bbValue) || 2);
  const sb = Math.max(1, Math.floor(bb / 2));
  const smallBlindInput = document.getElementById('small-blind');
  if (smallBlindInput) smallBlindInput.value = sb;
}

function onSettingMaxPlayersChange(players) {
  const suggestions = getPokerSuggestions(players);
  const startingChipsInput = document.getElementById('setting-starting-chips');
  const bigBlindInput = document.getElementById('setting-big-blind');
  const smallBlindInput = document.getElementById('setting-small-blind');

  if (startingChipsInput) startingChipsInput.value = suggestions.startingChips;
  if (bigBlindInput) bigBlindInput.value = suggestions.bigBlind;
  if (smallBlindInput) smallBlindInput.value = suggestions.smallBlind;
}

function onSettingBigBlindChange(bbValue) {
  const bb = Math.max(2, Number(bbValue) || 2);
  const sb = Math.max(1, Math.floor(bb / 2));
  const smallBlindInput = document.getElementById('setting-small-blind');
  if (smallBlindInput) smallBlindInput.value = sb;
}

// In-Game Settings Modal Functions
function openSettingsModal() {
  if (lastGameState && lastGameState.config) {
    const cfg = lastGameState.config;
    const seconds = cfg.turnTimeoutMs !== undefined ? Math.floor(cfg.turnTimeoutMs / 1000) : 30;
    const bb = cfg.bigBlind || 20;
    const sb = cfg.smallBlind || Math.max(1, Math.floor(bb / 2));
    document.getElementById('setting-turn-timer').value = seconds;
    document.getElementById('setting-max-seats').value = cfg.maxSeats || 8;
    document.getElementById('setting-big-blind').value = bb;
    document.getElementById('setting-small-blind').value = sb;
    document.getElementById('setting-starting-chips').value = cfg.startingChips || 1000;
    document.getElementById('setting-hand-helper').checked = cfg.showHandHelper !== false;
  }

  const saveBtn = document.getElementById('btn-save-settings');
  const hostNotice = document.getElementById('settings-host-notice');

  if (isHost) {
    saveBtn.style.display = 'block';
    hostNotice.textContent = t('settings_host_notice');
    hostNotice.style.color = 'var(--gold-light)';
    document.querySelectorAll('#settings-form select, #settings-form input:not(#setting-small-blind)').forEach(el => el.disabled = false);
  } else {
    saveBtn.style.display = 'none';
    hostNotice.textContent = t('settings_guest_notice');
    hostNotice.style.color = 'var(--accent-red)';
    document.querySelectorAll('#settings-form select, #settings-form input').forEach(el => el.disabled = true);
  }

  document.getElementById('settings-modal').classList.remove('hidden');
}

function closeSettingsModal() {
  document.getElementById('settings-modal').classList.add('hidden');
}

function closeSettingsOnBackdrop(e) {
  if (e.target.id === 'settings-modal') {
    closeSettingsModal();
  }
}

function handleSaveSettings(e) {
  e.preventDefault();
  if (!isHost) return;

  const turnSeconds = Number(document.getElementById('setting-turn-timer').value);
  const maxSeats = Math.min(Math.max(Number(document.getElementById('setting-max-seats').value) || 8, 2), 20);
  const bigBlind = Math.max(2, Number(document.getElementById('setting-big-blind').value) || 20);
  const smallBlind = Math.max(1, Math.floor(bigBlind / 2));
  const startingChips = Math.max(10, Number(document.getElementById('setting-starting-chips').value) || 1000);
  const showHandHelper = document.getElementById('setting-hand-helper').checked;

  socket.emit('update_room_settings', {
    turnTimeoutSeconds: turnSeconds >= 0 ? turnSeconds : 30,
    maxSeats: maxSeats,
    smallBlind: smallBlind,
    bigBlind: bigBlind,
    startingChips: startingChips,
    showHandHelper: showHandHelper
  });

  closeSettingsModal();
  showToast(currentLang === 'ar' ? 'جاري تحديث إعدادات الطاولة...' : 'Updating table settings...', 'info');
}

// ==========================================
// LOBBY TAB SWITCHING & ACTIONS
// ==========================================

function switchLobbyTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  if (tab === 'join') {
    document.getElementById('tab-join').classList.add('active');
    document.getElementById('form-join').classList.add('active');
    document.getElementById('join-name').focus();
  } else {
    document.getElementById('tab-create').classList.add('active');
    document.getElementById('form-create').classList.add('active');
    document.getElementById('create-name').focus();
  }
}

function handleCreateRoom() {
  const nameInput = document.getElementById('create-name').value.trim();
  const name = nameInput || 'Host';
  const maxSeats = Math.min(Math.max(Number(document.getElementById('max-seats').value) || 6, 2), 20);
  const startingChips = Math.max(10, Number(document.getElementById('starting-chips').value) || 1000);
  const bigBlind = Math.max(2, Number(document.getElementById('big-blind').value) || 20);
  const smallBlind = Math.max(1, Math.floor(bigBlind / 2));
  const turnSeconds = Number(document.getElementById('turn-timer').value);
  const showHandHelper = document.getElementById('show-hand-helper').checked;

  if (!myPlayerId) {
    myPlayerId = sessionStorage.getItem('poker_player_id') || 'usr_' + Math.random().toString(36).substring(2, 9);
  }

  sessionStorage.setItem('poker_name', name);
  sessionStorage.setItem('poker_player_id', myPlayerId);

  socket.emit('create_room', {
    name,
    playerId: myPlayerId,
    startingChips: startingChips,
    smallBlind: smallBlind,
    bigBlind: bigBlind,
    maxSeats: maxSeats,
    turnTimeoutSeconds: turnSeconds >= 0 ? turnSeconds : 30,
    showHandHelper: Boolean(showHandHelper)
  });
}

function handleJoinRoom() {
  const nameInput = document.getElementById('join-name').value.trim();
  const name = nameInput || 'Player';
  const roomCode = document.getElementById('join-code').value.trim().toUpperCase();

  if (!roomCode || roomCode.length < 4) {
    return showToast(currentLang === 'ar' ? 'الرجاء إدخال رمز غرفة صالح من 6 خانات' : 'Please enter a valid 6-character room code', 'error');
  }

  if (!myPlayerId) {
    myPlayerId = sessionStorage.getItem('poker_player_id') || 'usr_' + Math.random().toString(36).substring(2, 9);
  }

  sessionStorage.setItem('poker_name', name);
  sessionStorage.setItem('poker_player_id', myPlayerId);

  socket.emit('join_room', {
    name,
    roomCode,
    playerId: myPlayerId
  });
}

// ==========================================
// SOCKET EVENT HANDLERS
// ==========================================

socket.on('room_created', (data) => {
  currentRoomCode = data.roomCode;
  myPlayerId = data.playerId;
  isHost = true;
  mySeatIndex = data.seatIndex;

  sessionStorage.setItem('poker_room', currentRoomCode);
  sessionStorage.setItem('poker_player_id', myPlayerId);

  switchToTableView();
  showToast(currentLang === 'ar' ? `تم إنشاء الغرفة ${currentRoomCode}! شارك الرمز مع أصدقائك.` : `Room ${currentRoomCode} created! Share the code with friends.`, 'success');
});

socket.on('room_joined', (data) => {
  currentRoomCode = data.roomCode;
  myPlayerId = data.playerId;
  isHost = data.isHost;
  mySeatIndex = data.seatIndex;

  sessionStorage.setItem('poker_room', currentRoomCode);
  sessionStorage.setItem('poker_player_id', myPlayerId);

  switchToTableView();
  showToast(currentLang === 'ar' ? `تم الدخول إلى الطاولة ${currentRoomCode}` : `Joined table ${currentRoomCode}`, 'success');
});

socket.on('reconnect_success', (data) => {
  currentRoomCode = data.roomCode;
  myPlayerId = data.playerId;
  isHost = data.isHost;
  mySeatIndex = data.seatIndex;

  switchToTableView();
  showToast(currentLang === 'ar' ? 'تمت إعادة الاتصال بمقعدك بنجاح!' : 'Reconnected to your seat!', 'success');
});

socket.on('reconnect_failed', (data) => {
  sessionStorage.removeItem('poker_room');
  showToast(data.message || (currentLang === 'ar' ? 'تعذر استعادة الجلسة السابقة' : 'Could not restore previous session'), 'error');
  switchToLobbyView();
});

socket.on('game_state', (state) => {
  renderGameState(state);
});

socket.on('chat_message', (data) => {
  appendChatMessage(data);
});

socket.on('error_message', (data) => {
  showToast(data.message, 'error');
});

socket.on('settings_updated', (data) => {
  showToast(data.message || (currentLang === 'ar' ? 'تم تحديث إعدادات الطاولة!' : 'Table settings updated!'), 'success');
});

socket.on('left_room', () => {
  sessionStorage.removeItem('poker_room');
  currentRoomCode = null;
  switchToLobbyView();
  showToast(currentLang === 'ar' ? 'تمت مغادرة الطاولة' : 'Left the table', 'info');
});

function switchToTableView() {
  document.getElementById('lobby-view').classList.remove('active');
  document.getElementById('game-view').classList.add('active');
  document.getElementById('header-room-code').textContent = currentRoomCode;
}

function switchToLobbyView() {
  document.getElementById('game-view').classList.remove('active');
  document.getElementById('lobby-view').classList.add('active');
}

// ==========================================
// STATE RENDERING
// ==========================================

function renderGameState(state) {
  const prevState = lastGameState;
  lastGameState = state;

  // Header updates
  document.getElementById('header-room-code').textContent = state.roomCode || currentRoomCode;
  document.getElementById('hand-indicator').textContent = `${t('hand_prefix')}${state.handNumber || 1}`;
  document.getElementById('stage-indicator').textContent = translateStage(state.stage);

  // Pot amount
  document.getElementById('pot-amount').textContent = `$${state.pot.toLocaleString()}`;

  // Sound triggers based on state transitions
  if (prevState) {
    if (state.pot > prevState.pot) playSound('chip');
    if (state.communityCards.length > prevState.communityCards.length) playSound('deal');
  }

  // Render Community Cards
  renderCommunityCards(state.communityCards);

  // Render Seats
  renderSeats(state);

  // Render Winner Banner
  renderWinnerBanner(state);

  // Render Action Controls
  renderActionControls(state);

  // Render Hand Log
  renderHandHistory(state.handHistory || []);

  // Render Self Hand Strength
  renderSelfHandStrength(state);
}

function renderCommunityCards(cards) {
  const container = document.getElementById('community-cards');
  container.innerHTML = '';

  for (let i = 0; i < 5; i++) {
    if (i < cards.length) {
      const card = cards[i];
      const cardEl = createCardElement(card);
      container.appendChild(cardEl);
    } else {
      const emptySlot = document.createElement('div');
      emptySlot.className = 'card-slot empty';
      container.appendChild(emptySlot);
    }
  }
}

function createCardElement(card, isSmall = false) {
  const el = document.createElement('div');
  el.className = `poker-card ${card.color || (['h','d','♥','♦'].includes(card.suit) ? 'red' : 'black')}`;

  const rankStr = card.label || card.rank;
  const suitSymbol = card.symbol || card.suit;

  el.innerHTML = `
    <div class="card-corner top">
      <span>${rankStr}</span>
      <span class="card-suit-glyph">${suitSymbol}</span>
    </div>
    <div class="card-center-suit">${suitSymbol}</div>
    <div class="card-corner bottom">
      <span>${rankStr}</span>
      <span class="card-suit-glyph">${suitSymbol}</span>
    </div>
  `;
  return el;
}

function createCardBackElement() {
  const el = document.createElement('div');
  el.className = 'poker-card card-back';
  return el;
}

function renderSeats(state) {
  const container = document.getElementById('seats-container');
  container.innerHTML = '';

  const maxSeats = state.config.maxSeats || 8;
  const selfSeat = state.self ? state.self.seatIndex : -1;

  // Dynamically apply compact styling based on seat capacity
  if (maxSeats > 10) {
    container.classList.add('compact-seats-20');
    container.classList.remove('compact-seats-10');
  } else if (maxSeats > 6) {
    container.classList.add('compact-seats-10');
    container.classList.remove('compact-seats-20');
  } else {
    container.classList.remove('compact-seats-10', 'compact-seats-20');
  }

  for (let i = 0; i < maxSeats; i++) {
    // Relative seat positioning: anchor user at seat position 0 (bottom center)
    const displayPos = selfSeat !== -1 ? (i - selfSeat + maxSeats) % maxSeats : i;

    const seatWrapper = document.createElement('div');
    seatWrapper.className = `seat-wrapper seat-${displayPos}`;

    // Compute dynamic stadium-oval / ellipse coordinates so any number of seats (2 to 20) is placed perfectly around table
    const radiusX = 42.5; // % horizontal radius
    const radiusY = 35.5; // % vertical radius
    const centerX = 50;   // % center x
    const centerY = 44;   // % center y

    const leftPercent = (centerX - radiusX * Math.sin((2 * Math.PI * displayPos) / maxSeats)).toFixed(2);
    const topPercent = (centerY + radiusY * Math.cos((2 * Math.PI * displayPos) / maxSeats)).toFixed(2);

    seatWrapper.style.left = `${leftPercent}%`;
    seatWrapper.style.top = `${topPercent}%`;

    const player = state.seats[i];

    if (player) {
      const isSelf = state.self && player.id === state.self.id;
      const isTurn = state.currentTurnSeatIndex === i;

      if (isSelf) seatWrapper.classList.add('is-self');
      if (isTurn) seatWrapper.classList.add('active-turn');
      if (player.folded) seatWrapper.classList.add('folded');

      // Dealer / Blinds Badges
      let badgesHtml = '<div class="seat-badge-group">';
      if (state.dealerSeatIndex === i) badgesHtml += '<span class="badge-dealer" title="Dealer Button">D</span>';
      if (state.smallBlindSeatIndex === i) badgesHtml += '<span class="badge-sb" title="Small Blind">SB</span>';
      if (state.bigBlindSeatIndex === i) badgesHtml += '<span class="badge-bb" title="Big Blind">BB</span>';
      badgesHtml += '</div>';

      // Action Tag / Last Action
      let actionTagHtml = '';
      if (player.lastAction) {
        actionTagHtml = `<span class="seat-action-tag">${escapeHtml(translateAction(player.lastAction))}</span>`;
      } else if (player.folded) {
        actionTagHtml = `<span class="seat-action-tag">${t('folded')}</span>`;
      } else if (player.allIn) {
        actionTagHtml = `<span class="seat-action-tag">${t('all_in')}</span>`;
      } else if (player.disconnected) {
        actionTagHtml = `<span class="seat-action-tag" style="color:#ef4444">${t('away')}</span>`;
      }

      // Hole Cards
      let holeCardsHtml = '<div class="seat-hole-cards">';
      if (isSelf && state.self.holeCards && state.self.holeCards.length > 0 && !player.folded) {
        // Self cards
        state.self.holeCards.forEach(c => {
          const cardEl = createCardElement(c);
          holeCardsHtml += cardEl.outerHTML;
        });
      } else if (player.holeCards && player.holeCards.length > 0 && !player.folded) {
        // Revealed showdown cards
        player.holeCards.forEach(c => {
          const cardEl = createCardElement(c);
          holeCardsHtml += cardEl.outerHTML;
        });
      } else if (player.hasCards && !player.folded) {
        // Facedown cards
        holeCardsHtml += createCardBackElement().outerHTML;
        holeCardsHtml += createCardBackElement().outerHTML;
      }
      holeCardsHtml += '</div>';

      // Current Bet Chip Pill
      let betPillHtml = '';
      if (player.currentBet > 0) {
        betPillHtml = `<div class="seat-bet-pill">🪙 $${player.currentBet}</div>`;
      }

      // Creator Quick-Reload Button if player is bankrupt
      let hostRebuyHtml = '';
      if (isHost && player.chips === 0) {
        hostRebuyHtml = `<button class="host-rebuy-btn" onclick="handleHostRebuyPlayer('${player.id}')" title="Reload chips for ${escapeHtml(player.name)}">${t('reload_player_btn')}</button>`;
      }

      const youSuffix = isSelf ? (currentLang === 'ar' ? ' (أنت)' : ' (You)') : '';

      seatWrapper.innerHTML = `
        ${badgesHtml}
        <div class="seat-card">
          <span class="seat-name">${escapeHtml(player.name)}${youSuffix}</span>
          <span class="seat-chips">$${player.chips.toLocaleString()}</span>
          ${actionTagHtml}
          ${hostRebuyHtml}
        </div>
        ${holeCardsHtml}
        ${betPillHtml}
      `;
    } else {
      // Empty Seat slot
      seatWrapper.innerHTML = `
        <button class="empty-seat-btn" onclick="sitAtSeat(${i})" title="Sit Here">
          <span>${t('sit_btn')}</span>
        </button>
      `;
    }

    container.appendChild(seatWrapper);
  }
}

function renderWinnerBanner(state) {
  const banner = document.getElementById('winner-banner');
  if (state.winners && state.winners.length > 0 && (state.stage === 'showdown' || state.stage === 'hand_ended')) {
    if (state.winners.length === 1) {
      const winner = state.winners[0];
      document.getElementById('winner-title').textContent = `🏆 ${winner.name}`;
      const descText = currentLang === 'ar' 
        ? `فاز بمبلغ $${winner.amountWon.toLocaleString()} بـ ${translateHandDescription(winner.handDescription)}`
        : `Won $${winner.amountWon.toLocaleString()} with ${winner.handDescription}`;
      document.getElementById('winner-desc').textContent = descText;
    } else {
      const names = state.winners.map(w => w.name).join(' & ');
      const eachWon = state.winners[0].amountWon.toLocaleString();
      const titleText = currentLang === 'ar' 
        ? `🤝 تقسيم الوعاء بالتساوي (Chop) — ${names}`
        : `🤝 Split Pot (Chop) — ${names}`;
      const descText = currentLang === 'ar'
        ? `ربح كل لاعب $${eachWon} بـ ${translateHandDescription(state.winners[0].handDescription)}`
        : `Each won $${eachWon} with ${state.winners[0].handDescription}`;
      document.getElementById('winner-title').textContent = titleText;
      document.getElementById('winner-desc').textContent = descText;
    }
    banner.classList.remove('hidden');
    playSound('win');
  } else {
    banner.classList.add('hidden');
  }
}

function renderSelfHandStrength(state) {
  const el = document.getElementById('my-hand-strength');
  const nameEl = document.getElementById('hand-strength-name');

  const helperEnabled = state.config && state.config.showHandHelper !== false;

  if (helperEnabled && state.self && state.self.currentEvaluation && !state.self.folded && state.self.holeCards && state.self.holeCards.length > 0) {
    nameEl.textContent = translateHandDescription(state.self.currentEvaluation.description || state.self.currentEvaluation.name);
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

function renderActionControls(state) {
  const panelWaiting = document.getElementById('panel-waiting');
  const panelActions = document.getElementById('panel-actions');
  const btnHostStart = document.getElementById('btn-host-start');
  const btnHostDeal = document.getElementById('btn-host-deal');
  const btnRebuy = document.getElementById('btn-rebuy');
  const waitingText = document.getElementById('waiting-text');

  const isMyTurn = state.actions && state.actions.canAct;
  const isWaitingOrEnded = state.stage === 'waiting' || state.stage === 'hand_ended';
  const seatedPlayersCount = state.seats.filter(s => s !== null).length;

  if (isMyTurn) {
    panelWaiting.classList.remove('active');
    panelActions.classList.add('active');
    playSound('turn');

    const acts = state.actions;

    // Fold Button
    document.getElementById('btn-fold').disabled = !acts.canFold;

    // Check Button
    const btnCheck = document.getElementById('btn-check');
    btnCheck.disabled = !acts.canCheck;
    btnCheck.style.display = acts.canCheck ? 'flex' : 'none';

    // Call Button (Supports Protection of All-In)
    const btnCall = document.getElementById('btn-call');
    btnCall.disabled = !acts.canCall;
    btnCall.style.display = acts.canCall ? 'flex' : 'none';
    const isAllInCall = state.self && acts.callAmount >= state.self.chips;
    const callTitleEl = document.getElementById('call-button-title');
    if (callTitleEl) {
      callTitleEl.textContent = isAllInCall ? t('btn_allin') : t('btn_call');
    }
    document.getElementById('call-amount-label').textContent = `$${acts.callAmount}`;

    // Raise Button
    const btnRaise = document.getElementById('btn-raise');
    const isBet = state.currentBet === 0;
    document.getElementById('raise-button-title').textContent = isBet ? t('btn_bet') : t('btn_raise');

    // Configure Slider
    const slider = document.getElementById('raise-slider');
    const input = document.getElementById('raise-input');

    slider.min = acts.minRaise;
    slider.max = acts.maxRaise;
    slider.step = state.config.bigBlind || 10;

    input.min = acts.minRaise;
    input.max = acts.maxRaise;

    // Default raise value
    const defaultVal = Math.min(acts.minRaise, acts.maxRaise);
    slider.value = defaultVal;
    input.value = defaultVal;
    document.getElementById('raise-amount-label').textContent = `$${defaultVal}`;

    const canRaiseOrBet = (isBet && acts.canBet) || (!isBet && acts.canRaise);
    btnRaise.disabled = !canRaiseOrBet;
  } else {
    panelActions.classList.remove('active');
    panelWaiting.classList.add('active');

    if (state.pendingHostAction) {
      // Game is paused waiting for room creator / host to deal next card, reveal winner, or start next hand
      btnHostStart.classList.add('hidden');
      if (isHost) {
        if (state.pendingHostAction === 'start_next_hand') {
          waitingText.innerHTML = t('hand_finished_host');
          btnHostDeal.innerHTML = t('btn_start_next_hand');
        } else {
          waitingText.innerHTML = t('creator_ready_reveal');
          const hostActionKey = state.pendingHostAction;
          const hostActionLabel = t(hostActionKey) || state.pendingHostActionLabel || 'Deal Next Card';
          btnHostDeal.innerHTML = `👉 ${hostActionLabel}`;
        }
        btnHostDeal.classList.remove('hidden');
      } else {
        const hostActionKey = state.pendingHostAction;
        const hostActionLabel = t(hostActionKey) || state.pendingHostActionLabel || 'proceed';
        waitingText.textContent = t('creator_waiting_prompt', { action: hostActionLabel.toLowerCase() });
        btnHostDeal.classList.add('hidden');
      }
    } else if (isWaitingOrEnded) {
      if (btnHostDeal) btnHostDeal.classList.add('hidden');
      if (seatedPlayersCount < 2) {
        waitingText.textContent = t('waiting_for_seats');
        btnHostStart.classList.add('hidden');
      } else {
        waitingText.textContent = isHost ? t('table_ready_host') : t('waiting_host_start');
        btnHostStart.innerHTML = t('btn_start_hand');
        if (isHost) {
          btnHostStart.classList.remove('hidden');
        } else {
          btnHostStart.classList.add('hidden');
        }
      }
    } else {
      if (btnHostDeal) btnHostDeal.classList.add('hidden');
      const activeSeat = state.seats[state.currentTurnSeatIndex];
      const activeName = activeSeat ? activeSeat.name : (currentLang === 'ar' ? 'اللاعب' : 'player');
      waitingText.textContent = t('waiting_player_turn', { name: activeName });
      btnHostStart.classList.add('hidden');
    }

    // Creator-only Rebuy / Chip Reload Controls
    const anyBankrupt = state.seats.some(s => s && s.chips === 0);
    const selfBankrupt = state.self && state.self.chips === 0;

    if (isHost && (anyBankrupt || selfBankrupt)) {
      btnRebuy.textContent = `💰 ${t('btn_reload_table')} ($${(state.config.startingChips || 1000).toLocaleString()})`;
      btnRebuy.classList.remove('hidden');
    } else {
      btnRebuy.classList.add('hidden');
    }

    // For non-host players who ran out of chips, notify them to ask creator
    if (!isHost && selfBankrupt && isWaitingOrEnded) {
      waitingText.innerHTML = t('out_of_chips_warning');
    }
  }
}

// ==========================================
// RAISE SLIDER & PRESET BINDINGS
// ==========================================

function onRaiseSliderInput(val) {
  document.getElementById('raise-input').value = val;
  document.getElementById('raise-amount-label').textContent = `$${val}`;
}

function onRaiseNumberInput(val) {
  const num = Number(val);
  const slider = document.getElementById('raise-slider');
  slider.value = num;
  document.getElementById('raise-amount-label').textContent = `$${num}`;
}

function setRaisePreset(type) {
  if (!lastGameState || !lastGameState.actions) return;
  const acts = lastGameState.actions;
  const pot = lastGameState.pot;
  const bb = lastGameState.config.bigBlind;

  let target = acts.minRaise;

  switch (type) {
    case 'min':
      target = acts.minRaise;
      break;
    case '2x':
      target = acts.currentBet > 0 ? acts.currentBet * 2 : bb * 2;
      break;
    case '3x':
      target = acts.currentBet > 0 ? acts.currentBet * 3 : bb * 3;
      break;
    case 'pot':
      target = acts.currentBet + pot;
      break;
    case 'allin':
      target = acts.maxRaise;
      break;
  }

  target = Math.max(acts.minRaise, Math.min(target, acts.maxRaise));
  document.getElementById('raise-slider').value = target;
  document.getElementById('raise-input').value = target;
  document.getElementById('raise-amount-label').textContent = `$${target}`;
}

// ==========================================
// ACTIONS DISPATCH
// ==========================================

function handleAction(action) {
  if (!lastGameState || !lastGameState.actions || !lastGameState.actions.canAct) return;

  if (action === 'raise') {
    const amount = Number(document.getElementById('raise-input').value);
    socket.emit('player_action', { action: 'raise', amount });
  } else {
    socket.emit('player_action', { action });
  }
}

function handleHostAdvanceStage() {
  if (!isHost || !lastGameState || !lastGameState.pendingHostAction) return;
  socket.emit('host_advance_stage', { action: lastGameState.pendingHostAction });
  playSound('deal');
}

function handleStartGame() {
  socket.emit('start_game');
}

function handleHostRebuyPlayer(playerId) {
  if (!isHost) return;
  const amount = lastGameState?.config?.startingChips || 1000;
  const targetPlayer = lastGameState?.seats?.find(s => s && s.id === playerId);
  const name = targetPlayer ? targetPlayer.name : (currentLang === 'ar' ? 'هذا اللاعب' : 'this player');
  if (!confirm(t('confirm_reload_player', { amount: amount.toLocaleString(), name }))) {
    return;
  }
  socket.emit('rebuy', { targetPlayerId: playerId, amount });
  showToast(t('toast_reloaded_player', { amount: amount.toLocaleString(), name }), 'success');
}

function handleRebuy() {
  if (!isHost) return;
  const amount = lastGameState?.config?.startingChips || 1000;
  if (!confirm(t('confirm_reload_table', { amount: amount.toLocaleString() }))) {
    return;
  }
  socket.emit('rebuy', { targetPlayerId: 'all', amount });
  showToast(t('toast_reloaded_table', { amount: amount.toLocaleString() }), 'success');
}

function sitAtSeat(seatIndex) {
  const name = sessionStorage.getItem('poker_name') || 'Player';
  socket.emit('join_room', {
    roomCode: currentRoomCode,
    name,
    playerId: myPlayerId,
    preferredSeat: seatIndex
  });
}

function handleLeaveRoom() {
  if (confirm(t('confirm_leave'))) {
    socket.emit('leave_room');
  }
}

// ==========================================
// DRAWER / LOG / CHAT
// ==========================================

function toggleSideDrawer() {
  const drawer = document.getElementById('side-drawer');
  drawer.classList.toggle('open');
  if (drawer.classList.contains('open')) {
    unreadLogCount = 0;
    document.getElementById('log-count').textContent = '0';
  }
}

function switchDrawerTab(tab) {
  document.getElementById('tab-log').classList.toggle('active', tab === 'log');
  document.getElementById('tab-chat').classList.toggle('active', tab === 'chat');
  document.getElementById('drawer-log-pane').classList.toggle('active', tab === 'log');
  document.getElementById('drawer-chat-pane').classList.toggle('active', tab === 'chat');
}

function renderHandHistory(history) {
  const container = document.getElementById('log-messages');
  container.innerHTML = '';
  history.forEach(item => {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = translateLogMessage(item.text);
    container.appendChild(entry);
  });
  container.scrollTop = container.scrollHeight;
}

function appendChatMessage(data) {
  const container = document.getElementById('chat-messages');
  const entry = document.createElement('div');
  entry.className = 'chat-entry';
  entry.innerHTML = `<span class="chat-sender">${escapeHtml(data.sender)}:</span><span class="chat-text">${escapeHtml(data.text)}</span>`;
  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;

  const drawer = document.getElementById('side-drawer');
  if (!drawer.classList.contains('open')) {
    unreadLogCount++;
    document.getElementById('log-count').textContent = unreadLogCount;
  }
}

function handleSendChat(e) {
  e.preventDefault();
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (text) {
    socket.emit('send_chat', { text });
    input.value = '';
  }
}

function copyRoomCode() {
  if (!currentRoomCode) return;
  navigator.clipboard.writeText(currentRoomCode).then(() => {
    showToast(t('toast_copied_code', { code: currentRoomCode }), 'success');
  }).catch(() => {
    showToast(`Room code: ${currentRoomCode}`, 'info');
  });
}

function copyInviteLink() {
  if (!currentRoomCode) return;
  const link = `${window.location.origin}/?room=${currentRoomCode}`;
  navigator.clipboard.writeText(link).then(() => {
    showToast(t('toast_copied_link'), 'success');
  }).catch(() => {
    showToast(`Link: ${link}`, 'info');
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[m]);
}
