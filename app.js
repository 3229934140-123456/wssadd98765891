const STORAGE_KEY = 'writing-assistant-data';
const HISTORY_KEY = 'writing-assistant-history';

const DEFAULT_DATA = {
    workTitle: '',
    platform: '',
    dailyGoal: 4000,
    updateTime: '20:00',
    chaptersPerDay: 1,
    stockChapters: 3,
    safetyThreshold: 3,
    typingSpeed: 40,
    enableNotifications: true,
    editorContent: '',
    chapterName: '',
    todayWords: 0,
    morningGoal: 1333,
    afternoonGoal: 1333,
    eveningGoal: 1334,
    morningDone: 0,
    afternoonDone: 0,
    eveningDone: 0,
    todayChapters: 0,
    lastSaveDate: null
};

const WRITING_TIPS = [
    '专注当下，先写完今天的段落再说。',
    '写不下去的时候，先写100字试试，往往就进入状态了。',
    '与其纠结一句的得与失，不如踏实地推进故事情节。',
    '读者还在等你更新呢，别让他们久等~',
    '每一个字都是你和读者的约定。',
    '今天的努力，是明天存稿的底气。',
    '不要等灵感，先写起来灵感自然来。',
    '情节卡壳了？先跳过这一段，写后面的高潮部分。',
    '日更作者最酷，全勤作者更酷！',
    '读者的催更就是最大的动力。',
    '文笔不够，字数来凑；但别忘质量。',
    '完成比完美更重要，先写完再修改。'
];

const PLATFORM_IMPACT = {
    '起点中文网': { fullAttendance: '起点全勤奖要求日更2000字+', ranking: '断更会影响推荐位排期', reader: '追更读者易流失' },
    '晋江文学城': { fullAttendance: '积分机制影响榜单排名', ranking: '新晋榜、月榜排名下滑', reader: '收藏转化率下降' },
    '番茄小说': { fullAttendance: '影响全勤奖励和推荐流', ranking: '完读率和推荐算法权重', reader: '读者追更情绪波动大' },
    '七猫小说': { fullAttendance: '推荐池推荐权重下降', ranking: '热门榜曝光减少', reader: '书架弃书率升高' },
    '纵横中文网': { fullAttendance: '全勤奖资格取消风险', ranking: '分类榜名次下降', reader: '书评区负面评价增多' },
    '17K小说网': { fullAttendance: '连续更新奖励中断', ranking: '首页推荐减少', reader: '打赏和月票减少' },
    '掌阅': { fullAttendance: '推荐权重直接挂钩', ranking: '畅销榜名次滑落', reader: '付费订阅下降' },
    '其他': { fullAttendance: '平台推荐减少', ranking: '曝光度降低', reader: '读者追更体验变差' }
};

let appData = { ...DEFAULT_DATA };
let historyData = [];
let sessionStartWords = 0;
let notificationPermission = 'default';
let calendarYear = new Date().getFullYear();
let calendarMonth = new Date().getMonth();

function getTodayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDateStr(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getTimePeriod() {
    const h = new Date().getHours();
    if (h >= 6 && h < 12) return 'morning';
    if (h >= 12 && h < 18) return 'afternoon';
    return 'evening';
}

function loadData() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            appData = { ...DEFAULT_DATA, ...JSON.parse(saved) };
        }
        const history = localStorage.getItem(HISTORY_KEY);
        if (history) {
            historyData = JSON.parse(history);
        }
        checkDateReset();
    } catch (e) {
        console.error('加载数据失败:', e);
    }
}

function checkDateReset() {
    const today = getTodayStr();
    if (appData.lastSaveDate && appData.lastSaveDate !== today) {
        if (appData.todayWords > 0) {
            historyData.push({
                date: appData.lastSaveDate,
                words: appData.todayWords,
                goal: appData.dailyGoal,
                chapters: appData.todayChapters || 0
            });
        } else if (appData.lastSaveDate < today) {
            historyData.push({
                date: appData.lastSaveDate,
                words: 0,
                goal: appData.dailyGoal,
                chapters: 0
            });
        }
        appData.todayWords = 0;
        appData.morningDone = 0;
        appData.afternoonDone = 0;
        appData.eveningDone = 0;
        appData.todayChapters = 0;
        appData.editorContent = '';
        appData.chapterName = '';
        sessionStartWords = 0;
    }
    appData.lastSaveDate = today;
    saveData();
}

function saveData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
        localStorage.setItem(HISTORY_KEY, JSON.stringify(historyData.slice(-60)));
    } catch (e) {
        console.error('保存数据失败:', e);
    }
}

function countWords(text) {
    if (!text) return 0;
    const cn = text.match(/[\u4e00-\u9fa5]/g);
    const en = text.match(/[a-zA-Z]+/g);
    let count = cn ? cn.length : 0;
    count += en ? en.length : 0;
    return count;
}

function splitDailyGoal(goal) {
    const third = Math.floor(goal / 3);
    return {
        morning: third,
        afternoon: third,
        evening: goal - 2 * third
    };
}

function calculateETA(remaining, speed) {
    if (remaining <= 0 || speed <= 0) return '--:--';
    const mins = Math.ceil(remaining / speed);
    const now = new Date();
    now.setMinutes(now.getMinutes() + mins);
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function getYesterdayRecord() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = getDateStr(yesterday);
    return historyData.find(h => h.date === dateStr) || null;
}

function checkRiskLevel() {
    const todayWords = appData.todayWords;
    const todayGoal = appData.dailyGoal;
    const todayMet = todayWords >= todayGoal;
    const yesterday = getYesterdayRecord();
    const yesterdayWords = yesterday ? yesterday.words : 0;
    const yesterdayGoal = yesterday ? yesterday.goal : todayGoal;
    const yesterdayMet = yesterday ? yesterdayWords >= yesterdayGoal : false;
    const now = new Date();
    const updateParts = appData.updateTime.split(':');
    const updateH = parseInt(updateParts[0]);
    const hoursLeft = updateH - now.getHours();
    const todayProgress = todayGoal > 0 ? (todayWords / todayGoal) * 100 : 0;
    let level = 'normal';
    if (!todayMet && !yesterdayMet) {
        if (todayProgress < 30 && hoursLeft < 6) level = 'danger';
        else level = 'warning';
    } else if (!todayMet && todayProgress < 50 && hoursLeft < 4) {
        level = 'warning';
    }
    return {
        level,
        todayMet,
        yesterdayMet,
        todayWords,
        todayGoal,
        yesterdayWords,
        yesterdayGoal,
        todayProgress,
        hoursLeft
    };
}

function getStockDays() {
    if (appData.chaptersPerDay <= 0) return 0;
    return Math.floor(appData.stockChapters / appData.chaptersPerDay);
}

function getDepletionDate() {
    const stockDays = getStockDays();
    if (stockDays <= 0) return '今天！';
    const d = new Date();
    d.setDate(d.getDate() + stockDays);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function getChaptersNeeded() {
    const threshold = appData.safetyThreshold;
    const stockDays = getStockDays();
    if (stockDays >= threshold) return 0;
    const deficit = threshold - stockDays;
    const chaptersNeeded = deficit * appData.chaptersPerDay;
    return chaptersNeeded;
}

function showToast(title, message, type = 'info', duration = 5000) {
    if (!appData.enableNotifications && type !== 'info') return;
    const toast = document.getElementById('corner-toast');
    const toastTitle = document.getElementById('toast-title');
    const toastMessage = document.getElementById('toast-message');
    toast.className = `corner-toast ${type}`;
    toastTitle.textContent = title;
    toastMessage.textContent = message;
    const icons = { warning: '⚠️', danger: '🚨', info: '💡' };
    toast.querySelector('.toast-icon').textContent = icons[type] || '📢';
    toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
    if (notificationPermission === 'granted' && type !== 'info') {
        try {
            new Notification(title, { body: message });
        } catch (e) {}
    }
}

function showRiskModal() {
    const modal = document.getElementById('risk-modal');
    const body = document.getElementById('modal-body');
    const risk = checkRiskLevel();
    const platform = appData.platform || '其他';
    const impact = PLATFORM_IMPACT[platform] || PLATFORM_IMPACT['其他'];
    const deficit = Math.max(0, appData.dailyGoal - appData.todayWords);
    const suggestions = [];
    if (deficit > 2000) {
        suggestions.push(`今晚需补 ${deficit} 字，建议分2-3段写完`);
        suggestions.push('先写一个完整场景，大约1500字左右，快速推进');
    } else if (deficit > 0) {
        suggestions.push(`还差约 ${deficit} 字，冲刺一下即可完成`);
        suggestions.push('集中精力写完今天的章节结尾部分');
    } else {
        suggestions.push('今日任务已完成，可写明天的存稿');
    }
    suggestions.push('明天上午早点开始写，避免再次积压');
    const chaptersNeeded = getChaptersNeeded();
    if (chaptersNeeded > 0) {
        suggestions.push(`存稿不足安全线，建议额外补写 ${chaptersNeeded} 章存稿`);
    }
    const todayPct = risk.todayGoal > 0 ? Math.round((risk.todayWords / risk.todayGoal) * 100) : 0;
    const ydPct = risk.yesterdayGoal > 0 ? Math.round((risk.yesterdayWords / risk.yesterdayGoal) * 100) : 0;
    const html = `
        <h4>📊 近两日进度对比</h4>
        <table class="risk-detail-table">
            <thead>
                <tr><th>日期</th><th>实际字数</th><th>目标字数</th><th>完成度</th><th>状态</th></tr>
            </thead>
            <tbody>
                <tr>
                    <td>今天</td>
                    <td>${risk.todayWords}</td>
                    <td>${risk.todayGoal}</td>
                    <td class="${todayPct >= 100 ? 'highlight-ok' : 'highlight-danger'}">${todayPct}%</td>
                    <td>${risk.todayMet ? '✅ 达标' : '❌ 未达标'}</td>
                </tr>
                <tr>
                    <td>昨天</td>
                    <td>${risk.yesterdayWords}</td>
                    <td>${risk.yesterdayGoal}</td>
                    <td class="${ydPct >= 100 ? 'highlight-ok' : 'highlight-danger'}">${ydPct}%</td>
                    <td>${risk.yesterdayMet ? '✅ 达标' : '❌ 未达标'}</td>
                </tr>
            </tbody>
        </table>
        ${!risk.todayMet && !risk.yesterdayMet ? '<p style="color:var(--danger);font-weight:600;">⚠️ 今天和昨天均未达标，连续断更风险极高！</p>' : ''}
        <ul class="impact-list">
            <li>${impact.fullAttendance}</li>
            <li>${impact.ranking}</li>
            <li>${impact.reader}</li>
        </ul>
        <div class="suggestion-box">
            <h4>💪 补更建议</h4>
            <ul>
                ${suggestions.map(s => `<li>${s}</li>`).join('')}
            </ul>
        </div>
    `;
    body.innerHTML = html;
    modal.classList.add('show');
}

function renderWritingUI() {
    const title = appData.workTitle ? `《${appData.workTitle}》` : '《未命名作品》';
    document.getElementById('work-title-display').textContent = title;
    document.getElementById('work-platform-display').textContent = `签约平台：${appData.platform || '未设置'}`;
    document.getElementById('work-update-time-display').textContent = appData.updateTime || '未设置';
    document.getElementById('today-goal-words').textContent = appData.dailyGoal;
    document.getElementById('today-done-words').textContent = appData.todayWords;
    document.getElementById('today-chapters-count').textContent = appData.todayChapters || 0;
    const percent = appData.dailyGoal > 0 ? Math.min(100, Math.round((appData.todayWords / appData.dailyGoal) * 100)) : 0;
    document.getElementById('today-progress-fill').style.width = `${percent}%`;
    document.getElementById('today-progress-percent').textContent = percent;
    const split = splitDailyGoal(appData.dailyGoal);
    appData.morningGoal = split.morning;
    appData.afternoonGoal = split.afternoon;
    appData.eveningGoal = split.evening;
    document.getElementById('morning-goal').textContent = split.morning;
    document.getElementById('afternoon-goal').textContent = split.afternoon;
    document.getElementById('evening-goal').textContent = split.evening;
    document.getElementById('morning-done').textContent = appData.morningDone;
    document.getElementById('afternoon-done').textContent = appData.afternoonDone;
    document.getElementById('evening-done').textContent = appData.eveningDone;
    const mP = split.morning > 0 ? Math.min(100, (appData.morningDone / split.morning) * 100) : 0;
    const aP = split.afternoon > 0 ? Math.min(100, (appData.afternoonDone / split.afternoon) * 100) : 0;
    const eP = split.evening > 0 ? Math.min(100, (appData.eveningDone / split.evening) * 100) : 0;
    document.getElementById('morning-fill').style.width = `${mP}%`;
    document.getElementById('afternoon-fill').style.width = `${aP}%`;
    document.getElementById('evening-fill').style.width = `${eP}%`;
    const remaining = Math.max(0, appData.dailyGoal - appData.todayWords);
    document.getElementById('remaining-words').textContent = remaining;
    document.getElementById('eta-time').textContent = calculateETA(remaining, appData.typingSpeed);
    document.getElementById('writing-speed').textContent = appData.typingSpeed;
    renderRiskCard();
    renderSafetyCard();
    renderHistoryChart();
    const tipIdx = (new Date().getDate() + Math.floor(appData.todayWords / 500)) % WRITING_TIPS.length;
    document.getElementById('daily-tip').textContent = WRITING_TIPS[tipIdx];
    const editor = document.getElementById('writing-editor');
    if (editor.value !== (appData.editorContent || '')) {
        editor.value = appData.editorContent || '';
        updateEditorWordCount();
    }
    const cnInput = document.getElementById('chapter-name');
    if (cnInput.value !== (appData.chapterName || '')) {
        cnInput.value = appData.chapterName || '';
    }
}

function renderRiskCard() {
    const risk = checkRiskLevel();
    const badge = document.getElementById('risk-badge');
    const content = document.getElementById('risk-content');
    badge.className = 'risk-badge';
    if (risk.level === 'normal') {
        badge.textContent = '正常';
        badge.classList.add('normal');
        content.innerHTML = '<p class="risk-ok">当前进度正常，继续保持节奏！</p>';
    } else if (risk.level === 'warning') {
        badge.textContent = '注意';
        badge.classList.add('warning');
        const remaining = Math.max(0, risk.todayGoal - risk.todayWords);
        const yesterdayInfo = risk.yesterdayMet ? '昨日已达标' : `昨日仅写 ${risk.yesterdayWords} 字（未达标）`;
        content.innerHTML = `
            <p class="risk-warning">⚠️ 进度偏慢，今日还差 ${remaining} 字</p>
            <p style="margin-top:6px;font-size:12px;">${yesterdayInfo}</p>
            <p style="margin-top:6px;">建议集中精力，尽快完成今日段落。</p>
        `;
    } else {
        badge.textContent = '危险';
        badge.classList.add('danger');
        content.innerHTML = `
            <p class="risk-danger">🚨 连续两日未达标！</p>
            <p style="margin-top:6px;font-size:12px;">今天 ${risk.todayWords}/${risk.todayGoal} ｜ 昨天 ${risk.yesterdayWords}/${risk.yesterdayGoal}</p>
            <button class="btn btn-primary" style="margin-top:10px;padding:6px 12px;font-size:12px;" onclick="showRiskModal()">查看详情</button>
        `;
    }
}

function renderSafetyCard() {
    const stockDays = getStockDays();
    const threshold = appData.safetyThreshold;
    const barFill = document.getElementById('safety-bar-fill');
    const status = document.getElementById('safety-status');
    const depletionEl = document.getElementById('depletion-date');
    document.getElementById('current-stock').textContent = appData.stockChapters;
    document.getElementById('stock-days').textContent = stockDays;
    document.getElementById('safety-line').textContent = threshold;
    const depletionDate = getDepletionDate();
    depletionEl.textContent = depletionDate;
    const percent = threshold > 0 ? Math.min(100, (stockDays / (threshold * 2)) * 100) : 0;
    barFill.style.width = `${percent}%`;
    barFill.className = 'safety-bar-fill';
    status.className = 'safety-status';
    const todayKey = getTodayStr();
    if (stockDays >= threshold * 2) {
        status.textContent = '存稿充足 🎉';
        status.classList.add('safe');
        depletionEl.className = 'safety-value depletion-ok';
    } else if (stockDays >= threshold) {
        status.textContent = '存稿尚可';
        status.classList.add('safe');
        depletionEl.className = 'safety-value depletion-ok';
    } else if (stockDays > 0) {
        barFill.classList.add('warning');
        const needed = getChaptersNeeded();
        status.textContent = `存稿偏少 ⚠️ 建议补 ${needed} 章`;
        status.classList.add('warning');
        depletionEl.className = 'safety-value depletion-warning';
        if (renderSafetyCard._warned !== todayKey) {
            renderSafetyCard._warned = todayKey;
            showToast('存稿不足', `存稿仅够支撑 ${stockDays} 天（${depletionDate} 断粮），建议补写 ${needed} 章存稿`, 'warning');
        }
    } else {
        barFill.classList.add('danger');
        const needed = getChaptersNeeded();
        status.textContent = `无存稿！🚨 建议补 ${needed} 章`;
        status.classList.add('danger');
        depletionEl.className = 'safety-value depletion-danger';
        if (renderSafetyCard._warned !== todayKey) {
            renderSafetyCard._warned = todayKey;
            showToast('无存稿警告', `存稿已用尽！今天 ${appData.updateTime} 前务必要写！建议补 ${needed} 章`, 'danger');
        }
    }
}

function renderHistoryChart() {
    const chart = document.getElementById('history-chart');
    const today = new Date();
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    const bars = [];
    let maxWords = Math.max(appData.dailyGoal, 1000);
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = getDateStr(d);
        const record = historyData.find(h => h.date === dateStr);
        let words = 0;
        let goal = appData.dailyGoal;
        if (i === 0) {
            words = appData.todayWords;
            goal = appData.dailyGoal;
        } else if (record) {
            words = record.words;
            goal = record.goal || appData.dailyGoal;
        }
        if (words > maxWords) maxWords = words;
        bars.push({
            label: weekDays[d.getDay()],
            words,
            isToday: i === 0,
            goal
        });
    }
    chart.innerHTML = bars.map(b => {
        const height = Math.max(4, (b.words / maxWords) * 80);
        let cls = 'history-bar-fill';
        if (b.isToday) cls += ' today';
        else if (b.words >= b.goal * 0.9) cls += ' goal';
        else if (b.words < b.goal * 0.6 && b.words > 0) cls += ' low';
        return `
            <div class="history-bar">
                <span class="history-bar-value">${b.words >= 1000 ? (b.words / 1000).toFixed(1) + 'k' : b.words}</span>
                <div class="${cls}" style="height:${height}px" title="${b.words}字"></div>
                <span class="history-bar-label">${b.label}</span>
            </div>
        `;
    }).join('');
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const monthLabel = document.getElementById('cal-month-label');
    monthLabel.textContent = `${calendarYear}年${calendarMonth + 1}月`;
    const weekdays = ['一', '二', '三', '四', '五', '六', '日'];
    let html = weekdays.map(w => `<div class="cal-weekday">${w}</div>`).join('');
    const firstDay = new Date(calendarYear, calendarMonth, 1);
    let startDow = firstDay.getDay();
    if (startDow === 0) startDow = 7;
    startDow -= 1;
    for (let i = 0; i < startDow; i++) {
        html += '<div class="cal-day cal-empty"></div>';
    }
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const todayStr = getTodayStr();
    const todayDate = new Date();
    for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(calendarYear, calendarMonth, d);
        const dateStr = getDateStr(dateObj);
        const isToday = dateStr === todayStr;
        const isFuture = dateObj > todayDate;
        let cls = 'cal-day';
        let wordsLabel = '';
        if (isFuture) {
            cls += ' cal-future';
        } else {
            let words = 0;
            let goal = appData.dailyGoal;
            if (isToday) {
                words = appData.todayWords;
                goal = appData.dailyGoal;
            } else {
                const record = historyData.find(h => h.date === dateStr);
                if (record) {
                    words = record.words;
                    goal = record.goal || appData.dailyGoal;
                }
            }
            if (words >= goal) {
                cls += ' cal-done';
            } else if (words > 0) {
                cls += ' cal-partial';
            } else {
                cls += ' cal-miss';
            }
            if (words > 0) {
                wordsLabel = `<span class="cal-day-words">${words >= 1000 ? (words / 1000).toFixed(1) + 'k' : words}</span>`;
            }
        }
        if (isToday) cls += ' cal-today';
        html += `<div class="${cls}" data-date="${dateStr}" onclick="showCalendarDetail('${dateStr}')"><span class="cal-day-num">${d}</span>${wordsLabel}</div>`;
    }
    grid.innerHTML = html;
}

function showCalendarDetail(dateStr) {
    const detail = document.getElementById('calendar-detail');
    const titleEl = document.getElementById('detail-date-title');
    const bodyEl = document.getElementById('detail-body');
    const parts = dateStr.split('-');
    titleEl.textContent = `${parseInt(parts[1])}月${parseInt(parts[2])}日`;
    const todayStr = getTodayStr();
    let words = 0;
    let goal = appData.dailyGoal;
    let chapters = 0;
    if (dateStr === todayStr) {
        words = appData.todayWords;
        goal = appData.dailyGoal;
        chapters = appData.todayChapters || 0;
    } else {
        const record = historyData.find(h => h.date === dateStr);
        if (record) {
            words = record.words;
            goal = record.goal || appData.dailyGoal;
            chapters = record.chapters || 0;
        }
    }
    const pct = goal > 0 ? Math.round((words / goal) * 100) : 0;
    const isFuture = new Date(dateStr) > new Date();
    let statusText = '';
    let statusClass = '';
    if (isFuture) {
        statusText = '📅 尚未到来';
        statusClass = 'color:var(--text-muted)';
    } else if (words >= goal) {
        statusText = '✅ 达标';
        statusClass = 'color:var(--success)';
    } else if (words > 0) {
        statusText = '⚠️ 未达标';
        statusClass = 'color:var(--warning)';
    } else {
        statusText = '❌ 断更';
        statusClass = 'color:var(--danger)';
    }
    bodyEl.innerHTML = `
        <p><strong>目标字数：</strong>${goal} 字</p>
        <p><strong>实际字数：</strong>${words} 字</p>
        <p><strong>完成度：</strong>${pct}%</p>
        ${chapters > 0 ? `<p><strong>完成章节：</strong>${chapters} 章</p>` : ''}
        <p style="${statusClass};font-weight:600;margin-top:8px;">${statusText}</p>
    `;
    detail.style.display = 'block';
}

function renderPlanUI() {
    document.getElementById('work-title').value = appData.workTitle || '';
    document.getElementById('work-platform').value = appData.platform || '';
    document.getElementById('daily-goal').value = appData.dailyGoal;
    document.getElementById('update-time').value = appData.updateTime || '20:00';
    document.getElementById('chapters-per-day').value = appData.chaptersPerDay;
    document.getElementById('stock-chapters').value = appData.stockChapters;
    document.getElementById('safety-threshold').value = appData.safetyThreshold;
    document.getElementById('typing-speed').value = appData.typingSpeed;
    document.getElementById('enable-notifications').checked = appData.enableNotifications;
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.goal) === appData.dailyGoal);
    });
    updatePreviewBlocks();
    renderCalendar();
}

function updatePreviewBlocks() {
    const goal = parseInt(document.getElementById('daily-goal').value) || 4000;
    const split = splitDailyGoal(goal);
    document.getElementById('preview-morning').textContent = split.morning;
    document.getElementById('preview-afternoon').textContent = split.afternoon;
    document.getElementById('preview-evening').textContent = split.evening;
}

function updateEditorWordCount() {
    const editor = document.getElementById('writing-editor');
    const content = editor.value;
    const count = countWords(content);
    const session = Math.max(0, count - sessionStartWords);
    document.getElementById('editor-word-count').textContent = count;
    document.getElementById('session-words').textContent = session;
    appData.editorContent = content;
}

function commitEditorWordsToToday() {
    const editor = document.getElementById('writing-editor');
    const content = editor.value;
    const editorWords = countWords(content);
    const increment = Math.max(0, editorWords - sessionStartWords);
    if (increment > 0) {
        const period = getTimePeriod();
        if (period === 'morning') appData.morningDone += increment;
        else if (period === 'afternoon') appData.afternoonDone += increment;
        else appData.eveningDone += increment;
        appData.todayWords = appData.morningDone + appData.afternoonDone + appData.eveningDone;
    }
    sessionStartWords = editorWords;
    return increment;
}

function saveProgress(showMsg = true) {
    const chapterName = document.getElementById('chapter-name').value;
    const increment = commitEditorWordsToToday();
    appData.chapterName = chapterName;
    appData.lastSaveDate = getTodayStr();
    saveData();
    renderWritingUI();
    if (showMsg) {
        if (increment > 0) {
            showToast('保存成功', `本次新增 ${increment} 字，累计今日 ${appData.todayWords} 字`, 'info', 3000);
        } else {
            showToast('已保存', '进度已保存，继续加油！', 'info', 2000);
        }
    }
    const risk = checkRiskLevel();
    if (risk.level === 'danger') {
        setTimeout(showRiskModal, 600);
    }
    const stockDays = getStockDays();
    if (stockDays < appData.safetyThreshold) {
        const needed = getChaptersNeeded();
        setTimeout(() => {
            showToast('存稿提醒', `存稿仅够 ${stockDays} 天，建议补写 ${needed} 章存稿`, 'warning');
        }, 1000);
    }
}

function finishChapter() {
    const editor = document.getElementById('writing-editor');
    const content = editor.value;
    if (!content.trim()) {
        showToast('提示', '编辑器为空，无需完成本章', 'info', 2000);
        return;
    }
    const increment = commitEditorWordsToToday();
    appData.todayChapters = (appData.todayChapters || 0) + 1;
    appData.lastSaveDate = getTodayStr();
    saveData();
    editor.value = '';
    sessionStartWords = 0;
    document.getElementById('chapter-name').value = '';
    appData.editorContent = '';
    appData.chapterName = '';
    updateEditorWordCount();
    renderWritingUI();
    showToast('本章完成', `第 ${appData.todayChapters} 章已保存（+${increment}字），累计今日 ${appData.todayWords} 字。继续写下一章吧！`, 'info', 4000);
    const risk = checkRiskLevel();
    if (risk.level === 'danger') {
        setTimeout(showRiskModal, 800);
    }
}

function initTabs() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`${tab}-tab`).classList.add('active');
            if (tab === 'plan') renderPlanUI();
            else renderWritingUI();
        });
    });
}

function initEditor() {
    const editor = document.getElementById('writing-editor');
    sessionStartWords = countWords(editor.value);
    let saveTimer = null;
    editor.addEventListener('input', () => {
        updateEditorWordCount();
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            saveData();
        }, 2000);
    });
    document.getElementById('chapter-name').addEventListener('input', e => {
        appData.chapterName = e.target.value;
    });
    document.getElementById('save-btn').addEventListener('click', () => saveProgress(true));
    document.getElementById('finish-chapter-btn').addEventListener('click', finishChapter);
    document.getElementById('clear-btn').addEventListener('click', () => {
        if (confirm('确定要清空当前编辑器内容吗？（已保存的今日进度不会丢失）')) {
            editor.value = '';
            sessionStartWords = 0;
            updateEditorWordCount();
        }
    });
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveProgress(true);
        }
    });
}

function initPlan() {
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const goal = parseInt(btn.dataset.goal);
            document.getElementById('daily-goal').value = goal;
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updatePreviewBlocks();
        });
    });
    document.getElementById('daily-goal').addEventListener('input', () => {
        const val = parseInt(document.getElementById('daily-goal').value);
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.goal) === val);
        });
        updatePreviewBlocks();
    });
    document.getElementById('save-plan-btn').addEventListener('click', () => {
        const newGoal = parseInt(document.getElementById('daily-goal').value) || 4000;
        const oldGoal = appData.dailyGoal;
        appData.workTitle = document.getElementById('work-title').value.trim();
        appData.platform = document.getElementById('work-platform').value;
        appData.dailyGoal = newGoal;
        appData.updateTime = document.getElementById('update-time').value || '20:00';
        appData.chaptersPerDay = parseInt(document.getElementById('chapters-per-day').value) || 1;
        appData.stockChapters = parseInt(document.getElementById('stock-chapters').value) || 0;
        appData.safetyThreshold = parseInt(document.getElementById('safety-threshold').value) || 3;
        appData.typingSpeed = parseInt(document.getElementById('typing-speed').value) || 40;
        appData.enableNotifications = document.getElementById('enable-notifications').checked;
        const split = splitDailyGoal(appData.dailyGoal);
        appData.morningGoal = split.morning;
        appData.afternoonGoal = split.afternoon;
        appData.eveningGoal = split.evening;
        if (newGoal !== oldGoal) {
            const totalDone = appData.morningDone + appData.afternoonDone + appData.eveningDone;
            if (totalDone > 0) {
                const ratio = appData.dailyGoal > 0 ? totalDone / appData.dailyGoal : 0;
                appData.morningDone = Math.round(split.morning * Math.min(ratio, 1));
                appData.afternoonDone = Math.round(split.afternoon * Math.min(ratio, 1));
                appData.eveningDone = totalDone - appData.morningDone - appData.afternoonDone;
                if (appData.eveningDone < 0) appData.eveningDone = 0;
            }
        }
        saveData();
        renderWritingUI();
        showToast('计划已保存', '您的写作计划已更新，坚持就是胜利！', 'info', 3000);
        setTimeout(() => {
            document.querySelector('[data-tab="writing"]').click();
        }, 500);
    });
    document.getElementById('reset-btn').addEventListener('click', () => {
        if (confirm('确定要重置为默认设置吗？')) {
            appData = {
                ...DEFAULT_DATA,
                editorContent: appData.editorContent,
                chapterName: appData.chapterName,
                todayWords: appData.todayWords,
                morningDone: appData.morningDone,
                afternoonDone: appData.afternoonDone,
                eveningDone: appData.eveningDone,
                todayChapters: appData.todayChapters,
                lastSaveDate: appData.lastSaveDate
            };
            renderPlanUI();
            saveData();
        }
    });
    document.getElementById('cal-prev').addEventListener('click', () => {
        calendarMonth--;
        if (calendarMonth < 0) {
            calendarMonth = 11;
            calendarYear--;
        }
        renderCalendar();
        document.getElementById('calendar-detail').style.display = 'none';
    });
    document.getElementById('cal-next').addEventListener('click', () => {
        calendarMonth++;
        if (calendarMonth > 11) {
            calendarMonth = 0;
            calendarYear++;
        }
        renderCalendar();
        document.getElementById('calendar-detail').style.display = 'none';
    });
    document.getElementById('detail-close').addEventListener('click', () => {
        document.getElementById('calendar-detail').style.display = 'none';
    });
}

function initModals() {
    const modal = document.getElementById('risk-modal');
    document.getElementById('modal-close').addEventListener('click', () => modal.classList.remove('show'));
    document.getElementById('modal-cancel').addEventListener('click', () => modal.classList.remove('show'));
    document.getElementById('modal-confirm').addEventListener('click', () => {
        modal.classList.remove('show');
        document.querySelector('[data-tab="writing"]').click();
        document.getElementById('writing-editor').focus();
    });
    modal.addEventListener('click', e => {
        if (e.target === modal) modal.classList.remove('show');
    });
    document.getElementById('toast-close').addEventListener('click', () => {
        document.getElementById('corner-toast').classList.remove('show');
    });
}

function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(p => {
            notificationPermission = p;
        });
    } else if ('Notification' in window) {
        notificationPermission = Notification.permission;
    }
}

function initPeriodicCheck() {
    setInterval(() => {
        const risk = checkRiskLevel();
        const todayKey = getTodayStr();
        if (risk.level === 'danger' && initPeriodicCheck._lastModal !== todayKey) {
            const now = new Date();
            const updateParts = appData.updateTime.split(':');
            if (now.getHours() >= parseInt(updateParts[0]) - 2 && appData.todayWords < appData.dailyGoal * 0.5) {
                initPeriodicCheck._lastModal = todayKey;
                showRiskModal();
            }
        }
    }, 60 * 60 * 1000);
}

function init() {
    loadData();
    initTabs();
    initEditor();
    initPlan();
    initModals();
    renderWritingUI();
    requestNotificationPermission();
    setTimeout(() => {
        const risk = checkRiskLevel();
        if (risk.level === 'danger') {
            showRiskModal();
        } else if (risk.level === 'warning') {
            showToast('进度提醒', '今天的更新任务还没完成哦~', 'warning', 4000);
        }
        const stockDays = getStockDays();
        if (stockDays < appData.safetyThreshold) {
            const needed = getChaptersNeeded();
            setTimeout(() => {
                showToast('存稿提醒', `存稿仅够支撑 ${stockDays} 天，建议补写 ${needed} 章存稿`, 'warning');
            }, 2000);
        }
    }, 1500);
    initPeriodicCheck();
    console.log('码字断更助手已启动，祝您写作愉快！✍️');
}

document.addEventListener('DOMContentLoaded', init);
