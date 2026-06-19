// CẤU HÌNH ĐƯỜNG LINK: Dán link Web App URL lấy ở Bước 1 vào đây
const GOOGLE_SHEET_API = "https://script.google.com/macros/s/AKfycbwI7vnVr346TrnKwrstNfvFCch0E2U7wkpmvz3yPxYg7DDUYUGUjJzBfSrhtW6NYDoR6w/exec";

let coreDatabase = [];
let editorFilterDateValue = "";

window.onload = async function() {
    console.log("Đang tải dữ liệu từ Google Sheet...");
    
    // 1. Đợi hệ thống fetch toàn bộ dữ liệu từ Google Sheet về
    await loadDataFromCloud();
    
    // 2. Kiểm tra nếu có dữ liệu thì mới kích hoạt giao diện
    if (coreDatabase && coreDatabase.length > 0) {
        initFilters();        // Nạp ngày/tháng và dự án vào dropdown filter
        buildSplitTables();   // Đổ ngược dữ liệu vào 2 bảng chỉnh sửa ở Tab 2
        onFilterChange();     // Vẽ sơ đồ cây cho bản ghi đầu tiên
    } else {
        console.log("Database trên Google Sheet hiện tại đang rỗng.");
        clearDashboardUI();
    }
    
    // Lắng nghe sự kiện co giãn màn hình để vẽ lại đường nối SVG
    window.addEventListener('resize', connectAllNodes);
};

// Hàm GET dữ liệu: Kéo toàn bộ thông tin từ Cloud về (Tự động map dữ liệu 2 Sheet)
async function loadDataFromCloud() {
    try {
        const response = await fetch(GOOGLE_SHEET_API);
        const rawData = await response.json();
        
        // Tiến hành bóc tách và ép kiểu an toàn cho từng trường dữ liệu
        coreDatabase = rawData.map(r => ({
            id: r.id,
            date: r.date ? r.date.split('T')[0] : "", // Định dạng lại ngày YYYY-MM-DD
            etc: r.etc || "New Project",
            targetTiepNhan: Number(r.targetTiepNhan) || 0,
            chatUser: Number(r.chatUser) || 0,
            totalChat: Number(r.totalChat) || 0,
            totalChatbot: Number(r.totalChatbot) || 0,
            chatbotCsrSupport: Number(r.chatbotCsrSupport) || 0,
            unassigned: Number(r.unassigned) || 0,
            successEscalated: Number(r.successEscalated) || 0,
            chatbotCsr: Number(r.chatbotCsr) || 0,
            totalTagChatbotTransfer: Number(r.totalTagChatbotTransfer) || 0,
            queue: Number(r.queue) || 0,
            csrDukien: Number(r.csrDukien) || 0,
            csrThucte: Number(r.csrThucte) || 0,
            attendance: Number(r.attendance) || 0,
            productivity: parseFloat(r.productivity) || 0,
            frt: r.frt || "0s",
            aht: r.aht || "00:00",
            isLocked: (r.isLocked === true || r.isLocked === "true") // Chuyển chữ "true" thành Boolean true
        }));
        
        console.log("Đã nạp dữ liệu từ Google Sheet vào Dashboard thành công!");
    } catch (e) {
        console.error("Lỗi kết nối API Google Sheets:", e);
        alert("❌ Không thể tải dữ liệu từ Google Sheets. Hãy chắc chắn bạn đã Deploy Web App ở chế độ Anyone.");
        coreDatabase = [];
    }
}

// Hàm POST dữ liệu: Đẩy mảng dữ liệu lên Cloud để Apps Script tự động bóc tách thành 2 bảng riêng biệt
async function saveToGoogleSheet() {
    if (coreDatabase.length === 0) {
        alert("⚠️ Không có dữ liệu để đồng bộ.");
        return;
    }
    console.log("Đang tiến hành đồng bộ phân tách dữ liệu lên Google Sheets...");
    try {
        await fetch(GOOGLE_SHEET_API, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "saveAll",
                data: coreDatabase
            })
        });
        alert("☁️ Đồng bộ thành công! Dữ liệu đã được lưu trữ an toàn vào Sheet 'ChatFlow' và Sheet 'HRPerformance'.");
    } catch (error) {
        console.error("Lỗi đồng bộ Cloud:", error);
        alert("❌ Đã xảy ra lỗi trong quá trình truyền dữ liệu lên Google Sheet.");
    }
}

function applyCalculatedFormula(r) {
    let chatCsrPickFromChatbot = Number(r.chatbotCsr) - Number(r.successEscalated);
    let csrOnly = Number(r.chatbotCsrSupport) - Number(r.successEscalated) - chatCsrPickFromChatbot;
    let agentNoEscalated = chatCsrPickFromChatbot + csrOnly;
    
    let failEscalatedNoChatbot = Number(r.totalChat) - Number(r.totalChatbot) - csrOnly - Number(r.unassigned);
    let failEscalatedChatbot = Number(r.totalTagChatbotTransfer) - Number(r.successEscalated);
    
    let totalFailEscalated = failEscalatedNoChatbot + failEscalatedChatbot;
    let computedChatTransfer = agentNoEscalated + Number(r.successEscalated) + totalFailEscalated;

    return {
        chatCsrPick: chatCsrPickFromChatbot,
        csrOnly: csrOnly,
        agentNoEsc: agentNoEscalated,
        failNoBot: failEscalatedNoChatbot,
        failBot: failEscalatedChatbot,
        totalFail: totalFailEscalated,
        computedTransfer: computedChatTransfer
    };
}

function initFilters() {
    const etcSel = document.getElementById("filter-etc");
    const dateSel = document.getElementById("filter-date");
    if (coreDatabase.length === 0) {
        etcSel.innerHTML = `<option value="">-- Trống --</option>`;
        dateSel.innerHTML = `<option value="">-- Trống --</option>`;
        return;
    }
    let etcs = [...new Set(coreDatabase.map(item => item.etc))];
    let dates = [...new Set(coreDatabase.map(item => item.date))].sort();
    etcSel.innerHTML = etcs.map(e => `<option value="${e}">${e}</option>`).join('');
    dateSel.innerHTML = dates.map(d => `<option value="${d}">${d}</option>`).join('');
}

function onFilterChange() {
    const selectedEtc = document.getElementById("filter-etc").value;
    const selectedDate = document.getElementById("filter-date").value;
    let currentRecord = coreDatabase.find(r => r.etc === selectedEtc && r.date === selectedDate);
    if (currentRecord) updateDashboardView(currentRecord);
    else clearDashboardUI();
}

function clearDashboardUI() {
    const elements = ["kpi-vol", "kpi-total-trans", "kpi-users", "kpi-queued", "kpi-assisted", "sub-target", "v-total", "v-havebot", "v-nobot", "v-escalation", "v-botonly", "v-csrpick", "v-csronly", "v-unassigned", "v-success", "v-fail", "hr-exp", "hr-act", "hr-prod"];
    elements.forEach(id => document.getElementById(id).innerText = "0");
    document.getElementById("kpi-rate").innerText = "0%";
    document.getElementById("sub-kpi").innerText = "0%";
    document.getElementById("hr-atten").innerText = "0%";
    document.getElementById("hr-frt").innerText = "0s";
    document.getElementById("hr-aht").innerText = "00:00";
    const svg = document.getElementById("treeSvg");
    if(svg) svg.innerHTML = "";
}

function updateDashboardView(r) {
    let f = applyCalculatedFormula(r);
    let totalAssisted = Number(r.chatbotCsrSupport); 

    let kpiTiepNhanPct = Number(r.targetTiepNhan) > 0 ? ((totalAssisted / Number(r.targetTiepNhan)) * 100).toFixed(1) + "%" : "0%";

    document.getElementById("kpi-vol").innerText = Number(r.totalChat).toLocaleString();
    document.getElementById("kpi-total-trans").innerText = f.computedTransfer.toLocaleString(); 
    document.getElementById("kpi-users").innerText = Number(r.chatUser).toLocaleString();
    document.getElementById("kpi-queued").innerText = f.totalFail.toLocaleString(); 
    document.getElementById("kpi-assisted").innerText = totalAssisted.toLocaleString();
    document.getElementById("kpi-rate").innerText = f.computedTransfer > 0 ? ((totalAssisted / f.computedTransfer) * 100).toFixed(1) + "%" : "0%";
    
    document.getElementById("sub-target").innerText = Number(r.targetTiepNhan).toLocaleString();
    document.getElementById("sub-kpi").innerText = kpiTiepNhanPct;

    // --- CẬP NHẬT SƠ ĐỒ LUỒNG CÂY CHUẨN TỶ LỆ 100% ---
    document.getElementById("v-total").innerText = r.totalChat;
    
    let haveBotVal = Number(r.totalChat) - f.csrOnly;
    document.getElementById("v-havebot").innerText = haveBotVal;
    document.getElementById("p-havebot").innerText = Number(r.totalChat) > 0 ? ((haveBotVal / Number(r.totalChat)) * 100).toFixed(1) + "%" : "0%";
    
    document.getElementById("v-nobot").innerText = f.csrOnly; 
    document.getElementById("p-nobot").innerText = Number(r.totalChat) > 0 ? ((f.csrOnly / Number(r.totalChat)) * 100).toFixed(1) + "%" : "0%";
    
    document.getElementById("v-escalation").innerText = r.totalTagChatbotTransfer; 
    document.getElementById("p-escalation").innerText = Number(r.totalChatbot) > 0 ? ((Number(r.totalTagChatbotTransfer) / Number(r.totalChatbot)) * 100).toFixed(1) + "%" : "0%";
    
    let botOnlyVal = Number(r.totalChatbot) - f.computedTransfer;
    document.getElementById("v-botonly").innerText = botOnlyVal;
    document.getElementById("p-botonly").innerText = Number(r.totalChatbot) > 0 ? ((botOnlyVal / Number(r.totalChatbot)) * 100).toFixed(1) + "%" : "0%";

    document.getElementById("v-csrpick").innerText = f.chatCsrPick;
    document.getElementById("p-csrpick").innerText = haveBotVal > 0 ? ((f.chatCsrPick / haveBotVal) * 100).toFixed(1) + "%" : "0%";
    
    document.getElementById("v-csronly").innerText = f.csrOnly;
    document.getElementById("p-csronly").innerText = f.csrOnly > 0 ? ((f.csrOnly / f.csrOnly) * 100).toFixed(1) + "%" : "100%";
    
    document.getElementById("v-unassigned").innerText = r.unassigned;
    document.getElementById("p-unassigned").innerText = f.csrOnly > 0 ? ((Number(r.unassigned) / f.csrOnly) * 100).toFixed(1) + "%" : "0%";

    // Khắc phục lỗi trên + dưới không bằng 100% bằng cách chia chuẩn cho nhánh cha r.totalTagChatbotTransfer
    document.getElementById("v-success").innerText = r.successEscalated;
    document.getElementById("p-success").innerText = Number(r.totalTagChatbotTransfer) > 0 ? ((Number(r.successEscalated) / Number(r.totalTagChatbotTransfer)) * 100).toFixed(1) + "%" : "0%";

    document.getElementById("v-fail").innerText = f.totalFail; 
    document.getElementById("p-fail").innerText = Number(r.totalTagChatbotTransfer) > 0 ? ((f.totalFail / Number(r.totalTagChatbotTransfer)) * 100).toFixed(1) + "%" : "0%";

    // Khối nhân sự performance
    document.getElementById("hr-exp").innerText = r.csrDukien;
    document.getElementById("hr-act").innerText = r.csrThucte;
    document.getElementById("hr-atten").innerText = r.attendance + "%";
    document.getElementById("hr-prod").innerText = r.productivity;
    document.getElementById("hr-frt").innerText = r.frt;
    document.getElementById("hr-aht").innerText = r.aht;

    setTimeout(connectAllNodes, 60);
}

function buildSplitTables() {
    const tbodyChat = document.getElementById("tbody-chat-flow");
    const tbodyHR = document.getElementById("tbody-hr-performance");
    tbodyChat.innerHTML = ""; tbodyHR.innerHTML = "";

    if (coreDatabase.length === 0) {
        tbodyChat.innerHTML = `<tr><td colspan="20" style="padding: 15px; text-align:center;">Hệ thống chưa có dữ liệu. Nhấp nút Tạo Dòng Dữ Liệu Mới.</td></tr>`;
        return;
    }

    coreDatabase.forEach((r) => {
        if (editorFilterDateValue && r.date !== editorFilterDateValue) return;

        let f = applyCalculatedFormula(r);
        let lockState = r.isLocked ? "disabled" : "";
        let lockClass = r.isLocked ? "row-locked" : "";
        let actionBtn = r.isLocked 
            ? `<button class="action-btn btn-edit" onclick="toggleLockRow('${r.id}', false)">Sửa</button>` 
            : `<button class="action-btn btn-update" onclick="toggleLockRow('${r.id}', true)">Khóa/Lưu</button>`;

        let chatRow = `<tr class="flow-row ${lockClass}">
            <td><input type="date" value="${r.date}" id="date-${r.id}" ${lockState} onchange="syncDateToHR('${r.id}', this.value)"></td>
            <td><input type="text" value="${r.etc}" id="etc-${r.id}" ${lockState} oninput="syncRealtime('${r.id}')"></td>
            <td><input type="number" value="${r.targetTiepNhan}" id="tgt-${r.id}" ${lockState} oninput="syncRealtime('${r.id}')"></td>
            <td><input type="number" value="${r.chatUser}" id="user-${r.id}" ${lockState} oninput="syncRealtime('${r.id}')"></td>
            <td><input type="number" value="${r.totalChat}" id="chat-${r.id}" ${lockState} oninput="syncRealtime('${r.id}')"></td>
            <td><input type="number" value="${r.totalChatbot}" id="bot-${r.id}" ${lockState} oninput="syncRealtime('${r.id}')"></td>
            <td><input type="number" value="${r.chatbotCsrSupport}" id="support-${r.id}" ${lockState} oninput="syncRealtime('${r.id}')"></td>
            <td><input type="number" value="${r.unassigned}" id="un-${r.id}" ${lockState} oninput="syncRealtime('${r.id}')"></td>
            <td><input type="number" value="${r.successEscalated}" id="se-${r.id}" ${lockState} oninput="syncRealtime('${r.id}')"></td>
            <td><input type="number" value="${r.chatbotCsr}" id="cc-${r.id}" ${lockState} oninput="syncRealtime('${r.id}')"></td>
            <td><input type="number" value="${r.totalTagChatbotTransfer}" id="tbt-${r.id}" ${lockState} oninput="syncRealtime('${r.id}')"></td>
            <td><input type="number" value="${r.queue}" id="queue-${r.id}" ${lockState} oninput="syncRealtime('${r.id}')"></td>
            
            <td><input type="number" value="${f.computedTransfer}" id="f-trans-${r.id}" disabled></td>
            <td><input type="number" value="${f.chatCsrPick}" id="f-cp-${r.id}" disabled></td>
            <td><input type="number" value="${f.csrOnly}" id="f-co-${r.id}" disabled></td>
            <td><input type="number" value="${f.agentNoEsc}" id="f-ane-${r.id}" disabled></td>
            <td><input type="number" value="${f.failNoBot}" id="f-fnc-${r.id}" disabled></td>
            <td><input type="number" value="${f.failBot}" id="f-fec-${r.id}" disabled></td>
            <td><input type="number" value="${f.totalFail}" id="f-tfe-${r.id}" disabled></td>
            <td>${actionBtn}<button class="action-btn btn-delete" onclick="deleteRecord('${r.id}')">Xóa</button></td>
        </tr>`;
        tbodyChat.insertAdjacentHTML('beforeend', chatRow);

        let hrRow = `<tr class="hr-row ${lockClass}">
            <td><input type="date" value="${r.date}" id="hrdate-${r.id}" disabled></td>
            <td><input type="text" value="${r.etc}" id="hretc-${r.id}" disabled></td>
            <td><input type="number" value="${r.csrDukien}" id="dk-${r.id}" ${lockState} oninput="syncRealtime('${r.id}')"></td>
            <td><input type="number" value="${r.csrThucte}" id="tt-${r.id}" ${lockState} oninput="syncRealtime('${r.id}')"></td>
            <td><input type="number" value="${r.attendance}" id="at-${r.id}" ${lockState} oninput="syncRealtime('${r.id}')"></td>
            <td><input type="number" step="0.01" value="${r.productivity}" id="pr-${r.id}" ${lockState} oninput="syncRealtime('${r.id}')"></td>
            <td><input type="text" value="${r.frt}" id="frt-${r.id}" ${lockState} oninput="syncRealtime('${r.id}')"></td>
            <td><input type="text" value="${r.aht}" id="aht-${r.id}" ${lockState} oninput="syncRealtime('${r.id}')"></td>
        </tr>`;
        tbodyHR.insertAdjacentHTML('beforeend', hrRow);
    });
}

function syncRealtime(id) {
    let r = coreDatabase.find(item => item.id === id);
    if (!r) return;

    r.etc = document.getElementById(`etc-${id}`).value || "New Project";
    r.targetTiepNhan = Number(document.getElementById(`tgt-${id}`).value) || 0;
    r.chatUser = Number(document.getElementById(`user-${id}`).value) || 0;
    r.totalChat = Number(document.getElementById(`chat-${id}`).value) || 0;
    r.totalChatbot = Number(document.getElementById(`bot-${id}`).value) || 0;
    r.chatbotCsrSupport = Number(document.getElementById(`support-${id}`).value) || 0;
    r.unassigned = Number(document.getElementById(`un-${id}`).value) || 0;
    r.successEscalated = Number(document.getElementById(`se-${id}`).value) || 0;
    r.chatbotCsr = Number(document.getElementById(`cc-${id}`).value) || 0;
    r.totalTagChatbotTransfer = Number(document.getElementById(`tbt-${id}`).value) || 0;
    r.queue = Number(document.getElementById(`queue-${id}`).value) || 0; 
    
    r.csrDukien = Number(document.getElementById(`dk-${id}`).value) || 0;
    r.csrThucte = Number(document.getElementById(`tt-${id}`).value) || 0;
    r.attendance = Number(document.getElementById(`at-${id}`).value) || 0;
    r.productivity = parseFloat(document.getElementById(`pr-${id}`).value) || 0;
    r.frt = document.getElementById(`frt-${id}`).value || "0s";
    r.aht = document.getElementById(`aht-${id}`).value || "00:00";

    // Đồng bộ tức thì trường dự án sang bảng 2 làm nhãn hiển thị trực quan
    let hrEtcInput = document.getElementById(`hretc-${id}`);
    if (hrEtcInput) hrEtcInput.value = r.etc;

    let f = applyCalculatedFormula(r);
    document.getElementById(`f-trans-${id}`).value = f.computedTransfer;
    document.getElementById(`f-cp-${id}`).value = f.chatCsrPick;
    document.getElementById(`f-co-${id}`).value = f.csrOnly;
    document.getElementById(`f-ane-${id}`).value = f.agentNoEsc;
    document.getElementById(`f-fnc-${id}`).value = f.failNoBot;
    document.getElementById(`f-fec-${id}`).value = f.failBot;
    document.getElementById(`f-tfe-${id}`).value = f.totalFail;
}

function syncDateToHR(id, dateValue) {
    let r = coreDatabase.find(item => item.id === id);
    if (r) r.date = dateValue;
    let hrDateInput = document.getElementById(`hrdate-${id}`);
    if (hrDateInput) hrDateInput.value = dateValue;
}

function toggleLockRow(id, shouldLock) {
    let r = coreDatabase.find(item => item.id === id);
    if (!r) return;
    r.isLocked = shouldLock;
    if (shouldLock) syncRealtime(id);
    buildSplitTables();
    initFilters();
    onFilterChange();
}

function applyEditorDateFilter() {
    editorFilterDateValue = document.getElementById("editor-filter-date").value;
    buildSplitTables();
}

function clearEditorDateFilter() {
    document.getElementById("editor-filter-date").value = "";
    editorFilterDateValue = "";
    buildSplitTables();
}

function addNewConfigRow() {
    let newId = "rec_" + Date.now();
    let today = new Date().toISOString().split('T')[0];
    let newRecord = {
        id: newId, date: today, etc: "New Project", targetTiepNhan: 0, chatUser: 0, totalChat: 0,
        totalChatbot: 0, chatbotCsrSupport: 0, unassigned: 0, successEscalated: 0, chatbotCsr: 0, totalTagChatbotTransfer: 0, queue: 0,
        csrDukien: 0, csrThucte: 0, attendance: 0, productivity: 0, frt: "0s", aht: "00:00", isLocked: false
    };
    coreDatabase.push(newRecord);
    buildSplitTables();
    initFilters();
    onFilterChange();
}

function deleteRecord(id) {
    if (confirm("❌ Bạn có chắc chắn muốn xóa dòng dữ liệu này khỏi bộ nhớ client? (Vui lòng bấm 'Đồng bộ lên Google Sheet' để cập nhật thay đổi xóa lên Cloud)")) {
        coreDatabase = coreDatabase.filter(r => r.id !== id);
        buildSplitTables();
        initFilters();
        onFilterChange();
    }
}

function drawSingleLink(parentID, childID) {
    const svg = document.getElementById("treeSvg");
    const container = document.getElementById("treeContainer").getBoundingClientRect();
    const pEl = document.getElementById(parentID);
    const cEl = document.getElementById(childID);
    if (!pEl || !cEl) return;
    const pBox = pEl.getBoundingClientRect();
    const cBox = cEl.getBoundingClientRect();

    let x1 = pBox.right - container.left;
    let y1 = (pBox.top + pBox.bottom) / 2 - container.top;
    let x2 = cBox.left - container.left;
    let y2 = (cBox.top + cBox.bottom) / 2 - container.top;

    let controlX = x1 + (x2 - x1) / 2;
    let dPath = `M ${x1} ${y1} C ${controlX} ${y1}, ${controlX} ${y2}, ${x2} ${y2}`;

    let pathNode = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathNode.setAttribute("d", dPath);
    svg.appendChild(pathNode);
}

function connectAllNodes() {
    const svg = document.getElementById("treeSvg");
    if(!svg || coreDatabase.length === 0) return;
    svg.innerHTML = "";
    drawSingleLink("n-total", "n-havebot");
    drawSingleLink("n-total", "n-nobot");
    drawSingleLink("n-havebot", "n-escalation");
    drawSingleLink("n-havebot", "n-botonly");
    drawSingleLink("n-havebot", "n-csrpick");
    drawSingleLink("n-nobot", "n-csronly");
    drawSingleLink("n-nobot", "n-unassigned");
    drawSingleLink("n-escalation", "n-success");
    drawSingleLink("n-escalation", "n-fail");
}

function toggleTab(id, button) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    button.classList.add('active');
    if (id === 'dashboard-panel') setTimeout(connectAllNodes, 60);
}