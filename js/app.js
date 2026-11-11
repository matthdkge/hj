/**
 * app.js
 * 학과별 복합 다중게시판 시스템 프론트엔드 UI 컨트롤러
 */

const App = {
  state: {
    currentSpaceId: 'space_cse',
    currentBoardId: 'ALL',
    currentView: 'BOARD_LIST', // BOARD_LIST | POST_DETAIL | POST_FORM | MY_ACTIVITY | ADMIN_CENTER
    selectedPostId: null,
    editingPostId: null,
    editingCommentId: null,
    adminTab: 'MODERATION', // MODERATION | BOARDS | MEMBERS
    searchField: 'ALL',
    searchKeyword: '',
    selectedCategory: 'ALL',
    sortBy: 'LATEST',
    notiDropdownOpen: false,
    draftAttachments: []
  },

  async init() {
    await window.StorageManager.init();

    // 현재 로그인 사용자의 기본 소속 공간으로 초기 공간 설정
    const user = window.BoardService.getCurrentUser();
    if (user) {
      const myMembership = window.BoardService.db.spaceMembers.find(
        (sm) => sm.userId === user.id && sm.status === 'ACTIVE'
      );
      if (myMembership) {
        this.state.currentSpaceId = myMembership.spaceId;
      }
    }

    // 알림 드롭다운 외부 클릭 닫기
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.noti-wrapper')) {
        this.state.notiDropdownOpen = false;
        const dd = document.getElementById('notiDropdown');
        if (dd) dd.classList.remove('open');
      }
    });

    this.renderAll();
  },

  // 날짜 포맷 헬퍼 (YYYY-MM-DD HH:mm:ss)
  formatDateTime(isoStr) {
    if (!isoStr) return '-';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  },

  formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  },

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  showToast(msg) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3200);
  },

  // 전체 화면 갱신
  renderAll() {
    this.renderQuickRoleSwitcher();
    this.renderHeader();
    this.renderSidebar();
    this.renderMainContent();
  },

  // 1. 상단 5대 역할 및 학과별 조교 빠른 전환 바 렌더링
  renderQuickRoleSwitcher() {
    const container = document.getElementById('quickRoleSwitcher');
    if (!container) return;
    const currentUser = window.BoardService.getCurrentUser();

    const presetAccounts = [
      { userId: 'user_reader', label: '① 읽는 사람 (신입생)' },
      { userId: 'user_writer', label: '② 작성하는 사람 (일반재학생)' },
      { userId: 'user_notice', label: '③ 공지 등록자 (컴공 교수)' },
      { userId: 'user_mod', label: '④ 모더레이터 (컴공 게시물관리)' },
      { userId: 'user_admin', label: '⑤ 컴공 박조교 (컴공 권한만)' },
      { userId: 'user_design_admin', label: '🎨 디자인과 한조교 (디자인과 권한만)' },
      { userId: 'user_biz', label: '📊 경영과 오조교 (경영과 권한만)' }
    ];

    container.innerHTML = `
      <span class="switcher-title">⚡ 역할·학과별 조교 즉시 전환:</span>
      ${presetAccounts
        .map((acc) => {
          const isActive = currentUser && currentUser.id === acc.userId;
          return `<button class="role-switch-btn ${isActive ? 'active' : ''}" onclick="App.handleQuickSwitch('${acc.userId}')">${acc.label}</button>`;
        })
        .join('')}
    `;

    const statusEl = document.getElementById('persistenceStatusText');
    if (statusEl && window.StorageManager.db?.meta?.lastSavedAt) {
      const timeStr = this.formatDateTime(window.StorageManager.db.meta.lastSavedAt).slice(11);
      statusEl.textContent = `영구 저장소 자동 저장됨 (${timeStr})`;
    }
  },

  handleQuickSwitch(userId) {
    try {
      const user = window.BoardService.switchUser(userId);
      const mySm = window.BoardService.db.spaceMembers.find(
        (sm) => sm.userId === user.id && sm.status === 'ACTIVE'
      );
      const mySpace = mySm ? window.BoardService.db.spaces.find((s) => s.id === mySm.spaceId) : null;
      this.showToast(
        `'${user.name}' 계정으로 전환되었습니다. (${mySpace ? mySpace.name + ' 소속 권한만 활성화' : ''})`
      );
      this.renderAll();
    } catch (err) {
      alert(err.message);
    }
  },

  // 2. 헤더 렌더링 (내 글/댓글 관리, 알림 벨, 사용자 정보, 로그인/회원가입)
  renderHeader() {
    const container = document.getElementById('headerActions');
    if (!container) return;

    const user = window.BoardService.getCurrentUser();
    if (!user) {
      container.innerHTML = `
        <button class="btn btn-primary" onclick="App.openAuthModal('LOGIN')">🔐 로그인 / 회원가입</button>
      `;
      return;
    }

    const access = window.BoardService.checkSpaceAccess(this.state.currentSpaceId);
    const roleBadgeHtml = access.allowed
      ? `<span class="role-badge ${access.roleMeta.badgeClass}">${access.roleMeta.label}</span>`
      : `<span class="role-badge role-reader">현 공간 미소속</span>`;

    const notifications = window.BoardService.getUserNotifications();
    const unreadCount = notifications.filter((n) => !n.isRead).length;

    container.innerHTML = `
      <button class="btn ${this.state.currentView === 'MY_ACTIVITY' ? 'btn-primary' : 'btn-outline'}" onclick="App.openMyActivityView()">
        📝 내 게시글·댓글 관리
      </button>

      ${
        access.allowed && ['MODERATOR', 'SPACE_ADMIN'].includes(access.membership.role)
          ? `<button class="btn ${this.state.currentView === 'ADMIN_CENTER' ? 'btn-primary' : 'btn-outline'}" onclick="App.openAdminCenter()">
               🛡️ 공간·게시물 관리 센터
             </button>`
          : ''
      }

      <div class="noti-wrapper">
        <button class="btn btn-outline" onclick="App.toggleNotiDropdown(event)">
          🔔 알림 ${unreadCount > 0 ? `<span class="noti-badge">${unreadCount}</span>` : ''}
        </button>
        <div class="noti-dropdown ${this.state.notiDropdownOpen ? 'open' : ''}" id="notiDropdown">
          <div class="noti-header">
            <span>알림 내역 (${notifications.length})</span>
            <button class="btn btn-outline btn-sm" onclick="App.markAllNotificationsRead()">모두 읽음</button>
          </div>
          ${
            notifications.length === 0
              ? `<div style="padding:20px; text-align:center; color:var(--text-muted);">새로운 알림이 없습니다.</div>`
              : notifications
                  .map(
                    (n) => `
                  <div class="noti-item ${n.isRead ? '' : 'unread'}" onclick="App.handleNotificationClick('${n.id}', '${n.spaceId}', '${n.postId || ''}')">
                    <div>${this.escapeHtml(n.message)}</div>
                    <div class="noti-time">${this.formatDateTime(n.createdAt)}</div>
                  </div>
                `
                  )
                  .join('')
          }
        </div>
      </div>

      <div style="display:flex; align-items:center; gap:8px; padding-left:8px; border-left:1px solid var(--border);">
        <div style="text-align:right;">
          <div style="font-weight:700; font-size:13px;">${this.escapeHtml(user.name)}</div>
          <div>${roleBadgeHtml}</div>
        </div>
        <button class="btn btn-outline btn-sm" onclick="App.openAuthModal('LOGIN')">계정 변경 / 회원가입</button>
      </div>
    `;
  },

  toggleNotiDropdown(e) {
    e.stopPropagation();
    this.state.notiDropdownOpen = !this.state.notiDropdownOpen;
    const dd = document.getElementById('notiDropdown');
    if (dd) dd.classList.toggle('open', this.state.notiDropdownOpen);
  },

  async markAllNotificationsRead() {
    await window.BoardService.markAllNotificationsRead();
    this.renderHeader();
  },

  async handleNotificationClick(notiId, spaceId, postId) {
    await window.BoardService.markNotificationRead(notiId);
    this.state.notiDropdownOpen = false;
    if (spaceId) {
      this.state.currentSpaceId = spaceId;
    }
    if (postId) {
      const exists = window.BoardService.db.posts.some((p) => p.id === postId);
      if (exists) {
        await this.openPostDetail(postId);
        return;
      }
    }
    this.state.currentView = 'BOARD_LIST';
    this.renderAll();
  },

  // 3. 좌측 사이드바 렌더링 (운영 공간 목록 + 공간 내 다중게시판 목록 + 내 역할 권한 요약)
  renderSidebar() {
    const spaces = window.BoardService.db.spaces;
    const spaceContainer = document.getElementById('spaceListContainer');

    spaceContainer.innerHTML = spaces
      .map((sp) => {
        const access = window.BoardService.checkSpaceAccess(sp.id);
        const isActive = sp.id === this.state.currentSpaceId;
        const taMember = window.BoardService.db.spaceMembers.find(
          (sm) => sm.spaceId === sp.id && sm.role === 'SPACE_ADMIN' && sm.status === 'ACTIVE'
        );
        const taUser = taMember
          ? window.BoardService.db.users.find((u) => u.id === taMember.userId)
          : null;
        const taNameText = taUser ? taUser.name.split(' ')[0] : sp.assistantName || '조교 배정됨';
        return `
          <div class="space-item ${isActive ? 'active' : ''} ${access.allowed ? '' : 'locked'}" onclick="App.selectSpace('${sp.id}')">
            <div>
              <div>${sp.icon || '🏛️'} ${this.escapeHtml(sp.name)}</div>
              <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">👤 담당 조교: ${this.escapeHtml(taNameText)}</div>
            </div>
            <span class="space-tag ${access.allowed ? 'member' : 'blocked'}">
              ${access.allowed ? (access.membership.role === 'SPACE_ADMIN' ? '👑 내 학과(조교)' : '소속됨') : '🔒 타학과 차단'}
            </span>
          </div>
        `;
      })
      .join('');

    // 선택된 공간의 다중게시판 목록
    const boardContainer = document.getElementById('boardListContainer');
    const btnAddBoard = document.getElementById('btnAddBoardSidebar');
    const boardTitle = document.getElementById('sidebarBoardTitle');
    const currentSpace = spaces.find((s) => s.id === this.state.currentSpaceId);

    if (boardTitle && currentSpace) {
      boardTitle.textContent = `📋 ${currentSpace.name} 게시판`;
    }

    const access = window.BoardService.checkSpaceAccess(this.state.currentSpaceId);
    const perms = window.BoardService.getPermissions(this.state.currentSpaceId);

    if (btnAddBoard) {
      btnAddBoard.style.display = perms.canManageSpace ? 'inline-flex' : 'none';
    }

    if (!access.allowed) {
      boardContainer.innerHTML = `
        <div style="padding:14px; background:#fef2f2; color:#991b1b; border-radius:8px; font-size:12.5px;">
          🔒 <strong>공간 간 접근 차단됨</strong><br/>
          소속 학과 구성원이 아니므로 게시판 목록을 열람할 수 없습니다.
        </div>
      `;
    } else {
      const boards = window.BoardService.getBoardsBySpace(this.state.currentSpaceId);
      const allPostsCount = window.BoardService.db.posts.filter(
        (p) => p.spaceId === this.state.currentSpaceId
      ).length;

      boardContainer.innerHTML = `
        <div class="board-nav-item ${this.state.currentView === 'BOARD_LIST' && this.state.currentBoardId === 'ALL' ? 'active' : ''}" onclick="App.navigateToBoard('ALL')">
          <span>📚 전체 게시글 모아보기</span>
          <span class="board-count">${allPostsCount}</span>
        </div>
        ${boards
          .map((b) => {
            const count = window.BoardService.db.posts.filter((p) => p.boardId === b.id).length;
            const icon =
              b.type === 'NOTICE' ? '📢' : b.type === 'OPINION' ? '💡' : b.type === 'ARCHIVE' ? '📁' : '💬';
            const isActive = this.state.currentView === 'BOARD_LIST' && this.state.currentBoardId === b.id;
            return `
              <div class="board-nav-item ${isActive ? 'active' : ''}" onclick="App.navigateToBoard('${b.id}')">
                <span>${icon} ${this.escapeHtml(b.name)}</span>
                <span class="board-count">${count}</span>
              </div>
            `;
          })
          .join('')}
      `;
    }

    // 내 역할 및 권한 안내 카드
    const permCard = document.getElementById('myPermissionSummaryCard');
    if (!access.allowed) {
      permCard.innerHTML = `
        <div class="panel-title"><span>🔐 내 공간 권한 상태</span></div>
        <div style="font-size:13px; color:#dc2626; font-weight:600;">
          현재 공간 접근 권한 없음 (타 공간 격리)
        </div>
      `;
    } else {
      const rm = access.roleMeta;
      permCard.innerHTML = `
        <div class="panel-title"><span>🔐 현재 공간 내 역할</span></div>
        <div style="margin-bottom:8px;">
          <span class="role-badge ${rm.badgeClass}">${rm.label}</span>
        </div>
        <p style="font-size:12.5px; color:var(--text-muted); margin-bottom:10px;">
          ${rm.description}
        </p>
        <div style="font-size:12px; display:flex; flex-direction:column; gap:4px; background:#f8fafc; padding:10px; border-radius:7px; border:1px solid var(--border);">
          <div>• 게시글/댓글 읽기·검색: <strong style="color:#16a34a">가능</strong></div>
          <div>• 일반 게시글/댓글 작성: <strong style="color:${perms.canWriteComment ? '#16a34a' : '#dc2626'}">${perms.canWriteComment ? '가능' : '불가'}</strong></div>
          <div>• 공지사항 등록/고정: <strong style="color:${perms.canRegisterNotice ? '#16a34a' : '#dc2626'}">${perms.canRegisterNotice ? '가능' : '불가'}</strong></div>
          <div>• 부적절 게시물 블라인드/삭제: <strong style="color:${perms.canModerate ? '#16a34a' : '#dc2626'}">${perms.canModerate ? '가능' : '불가'}</strong></div>
          <div>• 게시판 및 운영공간 관리: <strong style="color:${perms.canManageSpace ? '#16a34a' : '#dc2626'}">${perms.canManageSpace ? '가능' : '불가'}</strong></div>
        </div>
      `;
    }
  },

  // 공간 선택
  selectSpace(spaceId) {
    this.state.currentSpaceId = spaceId;
    this.state.currentBoardId = 'ALL';
    this.state.currentView = 'BOARD_LIST';
    this.state.searchKeyword = '';
    this.state.selectedCategory = 'ALL';
    this.renderAll();
  },

  // 게시판 이동
  navigateToBoard(boardId) {
    this.state.currentBoardId = boardId;
    this.state.currentView = 'BOARD_LIST';
    this.state.selectedCategory = 'ALL';
    this.renderAll();
  },

  // 4. 메인 콘텐츠 렌더링 분기
  renderMainContent() {
    const main = document.getElementById('mainContentArea');
    if (!main) return;

    // 가장 먼저 공간 간 접근 차단 여부를 확인
    const access = window.BoardService.checkSpaceAccess(this.state.currentSpaceId);
    if (!access.allowed) {
      this.renderAccessDeniedView(main, access);
      return;
    }

    switch (this.state.currentView) {
      case 'POST_DETAIL':
        this.renderPostDetailView(main);
        break;
      case 'POST_FORM':
        this.renderPostFormView(main);
        break;
      case 'MY_ACTIVITY':
        this.renderMyActivityView(main);
        break;
      case 'ADMIN_CENTER':
        this.renderAdminCenterView(main);
        break;
      case 'BOARD_LIST':
      default:
        this.renderBoardListView(main);
        break;
    }
  },

  // 4-0. 공간 간 접근 차단(403) 화면
  renderAccessDeniedView(container, access) {
    const targetSpace = window.BoardService.db.spaces.find((s) => s.id === this.state.currentSpaceId);
    const currentUser = window.BoardService.getCurrentUser();

    // 해당 공간에 소속된 테스트 계정 찾기
    const sampleMember = window.BoardService.db.spaceMembers.find(
      (sm) => sm.spaceId === this.state.currentSpaceId && sm.status === 'ACTIVE'
    );
    const sampleUser = sampleMember
      ? window.BoardService.db.users.find((u) => u.id === sampleMember.userId)
      : null;

    container.innerHTML = `
      <div class="access-denied-card">
        <div class="access-denied-icon">🛑</div>
        <h2 style="font-size:22px; color:#991b1b; margin-bottom:10px;">
          공간 간 접근 차단 (403 Access Denied)
        </h2>
        <p style="font-size:15px; color:#334155; max-width:640px; margin:0 auto 20px;">
          ${this.escapeHtml(access.reason)}
        </p>
        <div style="background:#fef2f2; border:1px solid #fecaca; padding:14px 18px; border-radius:8px; max-width:560px; margin:0 auto 24px; text-align:left; font-size:13.5px; color:#7f1d1d;">
          <strong>🔒 보안 격리 정책 작동 중:</strong><br/>
          • 현재 로그인 계정: <strong>${currentUser ? this.escapeHtml(currentUser.name) : '비로그인'}</strong><br/>
          • 접근 시도 공간: <strong>${targetSpace ? this.escapeHtml(targetSpace.name) : '-'}</strong><br/>
          • 타 학과(공간)의 공지사항, 의견 게시글, 댓글, 첨부파일 및 검색 결과는 외부 공간 사용자에게 철저히 차단됩니다.
        </div>
        <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
          <button class="btn btn-primary" onclick="App.returnToMySpace()">
            ↩️ 내 소속 학과 공간으로 돌아가기
          </button>
          ${
            sampleUser
              ? `<button class="btn btn-outline" onclick="App.handleQuickSwitch('${sampleUser.id}')">
                   👤 '${this.escapeHtml(sampleUser.name)}' 계정으로 전환하여 이 공간 열람하기
                 </button>`
              : ''
          }
        </div>
      </div>
    `;
  },

  returnToMySpace() {
    const user = window.BoardService.getCurrentUser();
    if (user) {
      const mySm = window.BoardService.db.spaceMembers.find(
        (sm) => sm.userId === user.id && sm.status === 'ACTIVE'
      );
      if (mySm) {
        this.selectSpace(mySm.spaceId);
        return;
      }
    }
    this.selectSpace('space_cse');
  },

  // 4-1. 게시판 목록 및 검색 뷰
  renderBoardListView(container) {
    const space = window.BoardService.db.spaces.find((s) => s.id === this.state.currentSpaceId);
    const boards = window.BoardService.getBoardsBySpace(this.state.currentSpaceId);
    const currentBoard =
      this.state.currentBoardId === 'ALL'
        ? null
        : boards.find((b) => b.id === this.state.currentBoardId);

    const perms = window.BoardService.getPermissions(
      this.state.currentSpaceId,
      currentBoard ? currentBoard.id : null
    );

    const { notices, regulars, totalCount } = window.BoardService.getPosts({
      spaceId: this.state.currentSpaceId,
      boardId: this.state.currentBoardId,
      searchField: this.state.searchField,
      keyword: this.state.searchKeyword,
      category: this.state.selectedCategory,
      sortBy: this.state.sortBy
    });

    const categories = currentBoard
      ? currentBoard.categories || []
      : Array.from(new Set(boards.flatMap((b) => b.categories || [])));

    const boardMap = {};
    boards.forEach((b) => {
      boardMap[b.id] = b.name;
    });

    container.innerHTML = `
      <!-- 상단 공간/게시판 배너 -->
      <div class="space-banner">
        <div>
          <h2>${space.icon || '🏛️'} ${this.escapeHtml(space.name)} — ${currentBoard ? this.escapeHtml(currentBoard.name) : '전체 게시판 통합 보기'}</h2>
          <p>${this.escapeHtml(currentBoard ? currentBoard.description : space.description)}</p>
        </div>
        <div class="my-role-card">
          <div>현재 내 역할: <strong>${perms.roleMeta.label}</strong></div>
          <div style="margin-top:4px; opacity:0.9;">
            ${
              perms.canWritePost
                ? '✅ 이 게시판에 글을 작성할 수 있습니다.'
                : perms.role === 'READER'
                ? '👀 읽기 전용 역할입니다 (게시글 열람·검색·첨부 다운로드만 가능).'
                : '📢 공지 전용 게시판입니다 (공지 등록자 및 공간 관리자만 작성 가능).'
            }
          </div>
        </div>
      </div>

      <!-- 검색·필터·정렬·글쓰기 툴바 -->
      <div class="toolbar-card">
        <div class="search-group">
          <select class="select-control" onchange="App.handleCategoryChange(this.value)">
            <option value="ALL" ${this.state.selectedCategory === 'ALL' ? 'selected' : ''}>전체 카테고리</option>
            ${categories
              .map(
                (cat) =>
                  `<option value="${this.escapeHtml(cat)}" ${this.state.selectedCategory === cat ? 'selected' : ''}>${this.escapeHtml(cat)}</option>`
              )
              .join('')}
          </select>

          <select class="select-control" id="searchFieldSelect">
            <option value="ALL" ${this.state.searchField === 'ALL' ? 'selected' : ''}>제목+내용+작성자</option>
            <option value="TITLE" ${this.state.searchField === 'TITLE' ? 'selected' : ''}>제목만</option>
            <option value="CONTENT" ${this.state.searchField === 'CONTENT' ? 'selected' : ''}>내용만</option>
            <option value="AUTHOR" ${this.state.searchField === 'AUTHOR' ? 'selected' : ''}>작성자만</option>
          </select>

          <input
            type="text"
            class="input-control"
            id="searchKeywordInput"
            placeholder="필요한 공지나 의견 검색..."
            value="${this.escapeHtml(this.state.searchKeyword)}"
            style="min-width:210px;"
            onkeydown="if(event.key==='Enter') App.executeSearch()"
          />
          <button class="btn btn-primary" onclick="App.executeSearch()">🔍 검색</button>
          ${
            this.state.searchKeyword || this.state.selectedCategory !== 'ALL'
              ? `<button class="btn btn-outline" onclick="App.resetSearch()">초기화</button>`
              : ''
          }
        </div>

        <div style="display:flex; align-items:center; gap:8px;">
          <select class="select-control" onchange="App.handleSortChange(this.value)">
            <option value="LATEST" ${this.state.sortBy === 'LATEST' ? 'selected' : ''}>최신순 정렬</option>
            <option value="LIKES" ${this.state.sortBy === 'LIKES' ? 'selected' : ''}>👍 추천(공감)순 정렬</option>
            <option value="VIEWS" ${this.state.sortBy === 'VIEWS' ? 'selected' : ''}>👀 조회순 정렬</option>
          </select>

          ${
            perms.canWritePost
              ? `<button class="btn btn-primary" onclick="App.openPostWriteForm()">✏️ 게시글 작성</button>`
              : `<button class="btn btn-outline" style="opacity:0.6; cursor:not-allowed;" onclick="App.explainWriteRestriction()">🔒 글쓰기 제한됨</button>`
          }
        </div>
      </div>

      <!-- 게시글 목록 카드 -->
      <div class="panel-card" style="padding:0; overflow:hidden;">
        <div style="padding:12px 16px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
          <span style="font-weight:700;">총 ${totalCount}개의 게시글</span>
          <span style="font-size:12px; color:var(--text-muted);">* 상단에는 고정 공지사항이 우선 표시됩니다.</span>
        </div>

        <table class="post-table">
          <thead>
            <tr>
              <th style="width:90px;">구분</th>
              <th>제목</th>
              <th style="width:150px;">작성자</th>
              <th style="width:155px;">작성일시</th>
              <th style="width:70px; text-align:center;">추천</th>
              <th style="width:70px; text-align:center;">조회</th>
            </tr>
          </thead>
          <tbody>
            ${notices.map((p) => this.renderPostTableRow(p, boardMap, true)).join('')}
            ${regulars.map((p) => this.renderPostTableRow(p, boardMap, false)).join('')}
            ${
              notices.length === 0 && regulars.length === 0
                ? `<tr><td colspan="6" style="text-align:center; padding:40px; color:var(--text-muted);">조건에 맞는 게시글이 없습니다.</td></tr>`
                : ''
            }
          </tbody>
        </table>
      </div>
    `;
  },

  renderPostTableRow(post, boardMap, isNoticeSection) {
    const cmtCount = window.BoardService.db.comments.filter((c) => c.postId === post.id).length;
    const hasAtt = post.attachments && post.attachments.length > 0;
    const isModified = post.updatedAt && post.updatedAt !== post.createdAt;
    const boardName = boardMap[post.boardId] || '게시판';

    return `
      <tr class="post-row ${isNoticeSection ? 'notice-row' : ''} ${post.isBlinded ? 'blinded-row' : ''}" onclick="App.openPostDetail('${post.id}')">
        <td>
          ${
            post.isNotice
              ? `<span class="badge-notice">공지</span>`
              : `<span class="badge-cat">${this.escapeHtml(post.category || '일반')}</span>`
          }
        </td>
        <td>
          ${
            this.state.currentBoardId === 'ALL'
              ? `<span class="badge-board">${this.escapeHtml(boardName)}</span>`
              : ''
          }
          ${
            post.isBlinded
              ? `<span style="font-weight:700; color:#dc2626;">🚫 [블라인드 처리된 게시물] ${this.escapeHtml(post.title)}</span>`
              : `<span style="font-weight:${post.isNotice ? '700' : '500'};">${this.escapeHtml(post.title)}</span>`
          }
          ${hasAtt ? `<span class="att-icon" title="첨부파일 ${post.attachments.length}개">📎</span>` : ''}
          ${cmtCount > 0 ? `<span class="cmt-count">[${cmtCount}]</span>` : ''}
          ${isModified ? `<span style="font-size:11px; color:var(--text-muted); margin-left:4px;">(수정됨)</span>` : ''}
        </td>
        <td>${this.escapeHtml(post.authorName)}</td>
        <td style="font-size:12px; color:var(--text-muted);">${this.formatDateTime(post.createdAt).slice(0, 16)}</td>
        <td style="text-align:center; font-weight:700; color:var(--primary);">👍 ${post.likeUserIds?.length || 0}</td>
        <td style="text-align:center; color:var(--text-muted);">${post.viewCount || 0}</td>
      </tr>
    `;
  },

  handleCategoryChange(cat) {
    this.state.selectedCategory = cat;
    this.renderMainContent();
  },

  handleSortChange(sortBy) {
    this.state.sortBy = sortBy;
    this.renderMainContent();
  },

  executeSearch() {
    const fieldEl = document.getElementById('searchFieldSelect');
    const kwEl = document.getElementById('searchKeywordInput');
    if (fieldEl) this.state.searchField = fieldEl.value;
    if (kwEl) this.state.searchKeyword = kwEl.value;
    this.renderMainContent();
  },

  resetSearch() {
    this.state.searchField = 'ALL';
    this.state.searchKeyword = '';
    this.state.selectedCategory = 'ALL';
    this.renderMainContent();
  },

  explainWriteRestriction() {
    const perms = window.BoardService.getPermissions(this.state.currentSpaceId, this.state.currentBoardId);
    if (perms.role === 'READER') {
      alert('현재 역할이 [① 게시글을 읽는 사람(열람 전용)]이므로 글을 작성할 수 없습니다.\n상단 바에서 [② 작성하는 사람] 이상의 역할로 전환해 보세요!');
    } else {
      alert('이 게시판은 [공지 전용 게시판]입니다.\n[③ 공지사항을 등록하는 사람] 또는 [⑤ 게시판·운영공간을 관리하는 사람]만 글을 작성할 수 있습니다.');
    }
  },

  // 4-2. 게시글 상세 조회 뷰 (제목, 내용, 작성자, 작성일시, 수정일시, 첨부파일, 추천, 댓글, 관리자 대응)
  async openPostDetail(postId) {
    try {
      await window.BoardService.getPostDetail(postId, true);
      this.state.selectedPostId = postId;
      this.state.currentView = 'POST_DETAIL';
      this.state.editingCommentId = null;
      this.renderAll();
    } catch (err) {
      alert(err.message);
    }
  },

  renderPostDetailView(container) {
    let detail;
    try {
      const post = window.BoardService.db.posts.find((p) => p.id === this.state.selectedPostId);
      if (!post) throw new Error('게시글을 찾을 수 없습니다.');
      window.BoardService.assertSpaceAccess(post.spaceId);
      const board = window.BoardService.db.boards.find((b) => b.id === post.boardId);
      const comments = window.BoardService.db.comments
        .filter((c) => c.postId === post.id)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      detail = { post, board, comments };
    } catch (err) {
      container.innerHTML = `<div class="panel-card">${this.escapeHtml(err.message)}</div>`;
      return;
    }

    const { post, board, comments } = detail;
    const currentUser = window.BoardService.getCurrentUser();
    const perms = window.BoardService.getPermissions(post.spaceId, post.boardId);
    const isOwner = currentUser && post.authorId === currentUser.id;
    const isLiked = currentUser && (post.likeUserIds || []).includes(currentUser.id);

    container.innerHTML = `
      <div class="panel-card">
        <!-- 상단 이동 및 제어 버튼 바 -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
          <button class="btn btn-outline" onclick="App.navigateToBoard('${this.state.currentBoardId}')">
            ← 목록으로 돌아가기
          </button>

          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            ${
              isOwner
                ? `<button class="btn btn-outline" onclick="App.openPostEditForm('${post.id}')">✏️ 내 글 수정</button>
                   <button class="btn btn-danger" onclick="App.handleDeletePost('${post.id}')">🗑️ 내 글 삭제</button>`
                : ''
            }
            ${
              perms.canModerate
                ? `<button class="btn btn-outline" onclick="App.openMovePostModal('${post.id}')">📂 타 게시판으로 이동</button>
                   <button class="btn btn-warning" onclick="App.handleToggleBlindPost('${post.id}')">
                     ${post.isBlinded ? '👁️ 블라인드 해제' : '🚫 부적절 게시물 블라인드(숨김)'}
                   </button>
                   ${
                     !isOwner
                       ? `<button class="btn btn-danger" onclick="App.handleDeletePost('${post.id}')">🗑️ 관리자 강제 삭제</button>`
                       : ''
                   }`
                : ''
            }
          </div>
        </div>

        <!-- 게시글 헤더 정보 (제목, 작성자, 작성일시, 수정일시) -->
        <div class="post-detail-header">
          <div>
            ${post.isNotice ? `<span class="badge-notice">공지사항</span>` : ''}
            <span class="badge-board">${board ? this.escapeHtml(board.name) : '게시판'}</span>
            <span class="badge-cat">${this.escapeHtml(post.category || '일반')}</span>
          </div>

          <h1 class="post-detail-title">
            ${post.isBlinded ? '🚫 [블라인드 처리된 게시물] ' : ''}${this.escapeHtml(post.title)}
          </h1>

          <!-- 필수 6대 정보 메타데이터 그리드 -->
          <div class="post-meta-grid">
            <div class="post-meta-item"><strong>작성자:</strong> ${this.escapeHtml(post.authorName)}</div>
            <div class="post-meta-item"><strong>작성일시:</strong> ${this.formatDateTime(post.createdAt)}</div>
            <div class="post-meta-item">
              <strong>수정일시:</strong> ${this.formatDateTime(post.updatedAt)}
              ${post.updatedAt !== post.createdAt ? '<span style="color:var(--primary); font-weight:600;">(수정됨)</span>' : ''}
            </div>
            <div class="post-meta-item"><strong>조회수:</strong> ${post.viewCount || 0}</div>
            <div class="post-meta-item"><strong>첨부파일:</strong> ${(post.attachments || []).length}개</div>
          </div>
        </div>

        <!-- 블라인드 경고 또는 본문 내용 -->
        ${
          post.isBlinded
            ? `<div style="background:#fef2f2; border:1px solid #fca5a5; padding:20px; border-radius:8px; color:#991b1b; margin-bottom:16px;">
                 <strong>🚫 부적절한 게시물로 관리자에 의해 숨김(블라인드) 처리되었습니다.</strong><br/>
                 사유: ${this.escapeHtml(post.blindReason || '커뮤니티 운영원칙 위반')}
                 ${
                   perms.canModerate || isOwner
                     ? `<div style="margin-top:12px; padding-top:12px; border-top:1px dashed #fca5a5; color:#334155;">
                          <strong>[관리자/작성자 원본 확인용 본문]:</strong><br/>
                          <div style="white-space:pre-wrap; margin-top:6px;">${this.escapeHtml(post.content)}</div>
                        </div>`
                     : ''
                 }
               </div>`
            : `<div class="post-body">${this.escapeHtml(post.content)}</div>`
        }

        <!-- 첨부파일 목록 및 다운로드 -->
        ${
          post.attachments && post.attachments.length > 0
            ? `<div class="attachment-box">
                 <div style="font-weight:700; font-size:13.5px;">📎 첨부파일 (${post.attachments.length}개) — 소속 학과 구성원 전용 다운로드</div>
                 ${post.attachments
                   .map(
                     (att, idx) => `
                   <div class="attachment-item">
                     <div>
                       <strong>${this.escapeHtml(att.fileName)}</strong>
                       <span style="color:var(--text-muted); font-size:12px; margin-left:6px;">(${this.formatFileSize(att.fileSize)})</span>
                     </div>
                     <button class="btn btn-primary btn-sm" onclick="App.downloadAttachment('${post.id}', ${idx})">
                       ⬇️ 파일 다운로드
                     </button>
                   </div>
                 `
                   )
                   .join('')}
               </div>`
            : `<div class="attachment-box" style="color:var(--text-muted); font-size:13px;">📎 등록된 첨부파일이 없습니다.</div>`
        }

        <!-- 게시글 추천 및 신고 버튼 -->
        <div class="like-section">
          <button class="btn-like ${isLiked ? 'liked' : ''}" onclick="App.handleToggleLike('${post.id}')">
            👍 게시글 추천(공감) <span>${post.likeUserIds?.length || 0}</span>
          </button>
          <button class="btn btn-outline" onclick="App.openReportModal('POST', '${post.id}')">
            🚨 부적절 게시물 신고
          </button>
        </div>

        <!-- 댓글 영역 -->
        <div>
          <h3 style="font-size:16px; font-weight:800; margin-bottom:10px;">
            💬 댓글 (${comments.length})
          </h3>

          <div class="comment-list">
            ${
              comments.length === 0
                ? `<div style="padding:18px; text-align:center; color:var(--text-muted); background:#f8fafc; border-radius:8px;">첫 번째 댓글로 의견을 남겨보세요!</div>`
                : comments.map((c) => this.renderCommentItem(c, currentUser, perms)).join('')
            }
          </div>

          <!-- 댓글 작성 폼 -->
          <div style="margin-top:16px;">
            ${
              perms.canWriteComment
                ? `<div style="display:flex; gap:8px;">
                     <textarea
                       id="newCommentInput"
                       class="input-control"
                       style="flex:1; min-height:70px; resize:vertical;"
                       placeholder="공지에 대한 질문이나 학과 의견에 대한 댓글을 입력하세요..."
                     ></textarea>
                     <button class="btn btn-primary" style="padding:0 20px;" onclick="App.handleCreateComment('${post.id}')">
                       댓글 등록
                     </button>
                   </div>`
                : `<div style="padding:14px; background:#f1f5f9; border-radius:8px; color:var(--text-muted); font-size:13px;">
                     🔒 현재 역할(<strong>게시글을 읽는 사람</strong>)은 댓글 작성 권한이 없습니다. 댓글을 작성하려면 상단 바에서 <strong>작성하는 사람</strong> 이상의 역할로 전환하세요.
                   </div>`
            }
          </div>
        </div>
      </div>
    `;
  },

  renderCommentItem(cmt, currentUser, perms) {
    const isOwner = currentUser && cmt.authorId === currentUser.id;
    const isEditing = this.state.editingCommentId === cmt.id;
    const isModified = cmt.updatedAt && cmt.updatedAt !== cmt.createdAt;

    return `
      <div class="comment-item" style="${cmt.isBlinded ? 'background:#fef2f2; border-color:#fca5a5;' : ''}">
        <div class="comment-header">
          <div>
            <span class="comment-author">${this.escapeHtml(cmt.authorName)}</span>
            <span class="comment-date">
              작성: ${this.formatDateTime(cmt.createdAt)}
              ${isModified ? `(수정: ${this.formatDateTime(cmt.updatedAt)})` : ''}
            </span>
          </div>
          <div style="display:flex; gap:6px;">
            ${
              isOwner && !cmt.isBlinded
                ? `<button class="btn btn-outline btn-sm" onclick="App.startEditComment('${cmt.id}')">수정</button>`
                : ''
            }
            ${
              isOwner || perms.canModerate
                ? `<button class="btn btn-outline btn-sm" style="color:#dc2626;" onclick="App.handleDeleteComment('${cmt.id}')">삭제</button>`
                : ''
            }
            ${
              perms.canModerate
                ? `<button class="btn btn-outline btn-sm" onclick="App.handleToggleBlindComment('${cmt.id}')">
                     ${cmt.isBlinded ? '블라인드 해제' : '블라인드'}
                   </button>`
                : ''
            }
          </div>
        </div>

        ${
          isEditing
            ? `<div style="display:flex; gap:8px; margin-top:8px;">
                 <input type="text" id="editCommentInput_${cmt.id}" class="input-control" style="flex:1;" value="${this.escapeHtml(cmt.content)}" />
                 <button class="btn btn-primary btn-sm" onclick="App.handleSaveComment('${cmt.id}')">저장</button>
                 <button class="btn btn-outline btn-sm" onclick="App.cancelEditComment()">취소</button>
               </div>`
            : cmt.isBlinded
            ? `<div style="color:#991b1b; font-size:13px;">🚫 부적절한 댓글로 관리자에 의해 블라인드(숨김) 처리되었습니다.</div>`
            : `<div style="white-space:pre-wrap; font-size:13.5px;">${this.escapeHtml(cmt.content)}</div>`
        }
      </div>
    `;
  },

  downloadAttachment(postId, attIndex) {
    try {
      const post = window.BoardService.db.posts.find((p) => p.id === postId);
      if (!post) throw new Error('게시글을 찾을 수 없습니다.');

      // 공간 간 접근 차단 검증
      window.BoardService.assertSpaceAccess(post.spaceId);

      const att = post.attachments && post.attachments[attIndex];
      if (!att) throw new Error('첨부파일을 찾을 수 없습니다.');

      const a = document.createElement('a');
      a.href = att.dataUrl;
      a.download = att.fileName || 'attachment.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      this.showToast(`'${att.fileName}' 다운로드를 시작합니다.`);
    } catch (err) {
      alert(err.message);
    }
  },

  async handleToggleLike(postId) {
    try {
      const res = await window.BoardService.togglePostLike(postId);
      this.showToast(res.liked ? '👍 이 게시글을 추천했습니다.' : '추천을 취소했습니다.');
      this.renderAll();
    } catch (err) {
      alert(err.message);
    }
  },

  async handleCreateComment(postId) {
    const input = document.getElementById('newCommentInput');
    if (!input) return;
    try {
      await window.BoardService.createComment(postId, input.value);
      input.value = '';
      this.showToast('댓글이 등록되었습니다.');
      this.renderAll();
    } catch (err) {
      alert(err.message);
    }
  },

  startEditComment(cmtId) {
    this.state.editingCommentId = cmtId;
    this.renderMainContent();
  },

  cancelEditComment() {
    this.state.editingCommentId = null;
    this.renderMainContent();
  },

  async handleSaveComment(cmtId) {
    const input = document.getElementById(`editCommentInput_${cmtId}`);
    if (!input) return;
    try {
      await window.BoardService.updateComment(cmtId, input.value);
      this.state.editingCommentId = null;
      this.showToast('댓글이 수정되었습니다.');
      this.renderAll();
    } catch (err) {
      alert(err.message);
    }
  },

  async handleDeleteComment(cmtId) {
    if (!confirm('이 댓글을 삭제하시겠습니까?')) return;
    try {
      await window.BoardService.deleteComment(cmtId);
      this.showToast('댓글이 삭제되었습니다.');
      this.renderAll();
    } catch (err) {
      alert(err.message);
    }
  },

  async handleToggleBlindPost(postId) {
    try {
      const post = await window.BoardService.toggleBlindPost(postId);
      this.showToast(post.isBlinded ? '🚫 게시물이 블라인드(숨김) 처리되었습니다.' : '블라인드 처리가 해제되었습니다.');
      this.renderAll();
    } catch (err) {
      alert(err.message);
    }
  },

  async handleToggleBlindComment(cmtId) {
    try {
      await window.BoardService.toggleBlindComment(cmtId);
      this.showToast('댓글 블라인드 상태가 변경되었습니다.');
      this.renderAll();
    } catch (err) {
      alert(err.message);
    }
  },

  async handleDeletePost(postId) {
    if (!confirm('정말 이 게시글을 삭제하시겠습니까?')) return;
    try {
      await window.BoardService.deletePost(postId);
      this.showToast('게시글이 삭제되었습니다.');
      this.state.currentView = 'BOARD_LIST';
      this.renderAll();
    } catch (err) {
      alert(err.message);
    }
  },

  // 4-3. 게시글 작성 및 수정 화면 (제목, 내용, 작성자, 작성일시, 수정일시, 첨부파일)
  openPostWriteForm() {
    this.state.editingPostId = null;
    this.state.draftAttachments = [];
    this.state.currentView = 'POST_FORM';
    this.renderMainContent();
  },

  openPostEditForm(postId) {
    const post = window.BoardService.db.posts.find((p) => p.id === postId);
    if (!post) return;
    this.state.editingPostId = post.id;
    this.state.draftAttachments = [...(post.attachments || [])];
    this.state.currentView = 'POST_FORM';
    this.renderMainContent();
  },

  renderPostFormView(container) {
    const isEdit = Boolean(this.state.editingPostId);
    const editingPost = isEdit
      ? window.BoardService.db.posts.find((p) => p.id === this.state.editingPostId)
      : null;

    const currentUser = window.BoardService.getCurrentUser();
    const perms = window.BoardService.getPermissions(this.state.currentSpaceId);
    const allBoards = window.BoardService.getBoardsBySpace(this.state.currentSpaceId);

    // 작성 가능한 게시판 필터링 (일반 작성자는 NOTICE_ONLY 게시판 제외)
    const writableBoards = allBoards.filter(
      (b) => b.writePermission !== 'NOTICE_ONLY' || perms.canRegisterNotice
    );

    if (writableBoards.length === 0) {
      container.innerHTML = `
        <div class="panel-card">
          <h3>작성 가능한 게시판이 없습니다.</h3>
          <button class="btn btn-outline" style="margin-top:12px;" onclick="App.navigateToBoard('ALL')">돌아가기</button>
        </div>
      `;
      return;
    }

    const selectedBoardId = editingPost
      ? editingPost.boardId
      : this.state.currentBoardId !== 'ALL' && writableBoards.some((b) => b.id === this.state.currentBoardId)
      ? this.state.currentBoardId
      : writableBoards[0].id;

    const activeBoard = writableBoards.find((b) => b.id === selectedBoardId) || writableBoards[0];
    const nowDisplay = this.formatDateTime(new Date().toISOString());

    container.innerHTML = `
      <div class="panel-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; padding-bottom:12px; border-bottom:1px solid var(--border);">
          <h2 style="font-size:19px; font-weight:800;">
            ${isEdit ? '✏️ 게시글 수정' : '📝 새 게시글 작성'}
          </h2>
          <button class="btn btn-outline" onclick="App.cancelPostForm()">취소</button>
        </div>

        <!-- 자동 기록 정보 안내 박스 (작성자, 작성일시, 수정일시) -->
        <div class="post-meta-grid" style="margin-bottom:16px;">
          <div class="post-meta-item">
            <strong>작성자:</strong> ${this.escapeHtml(editingPost ? editingPost.authorName : currentUser.name)}
          </div>
          <div class="post-meta-item">
            <strong>작성일시:</strong> ${editingPost ? this.formatDateTime(editingPost.createdAt) : `${nowDisplay} (등록 시 자동 기록)`}
          </div>
          <div class="post-meta-item">
            <strong>수정일시:</strong> ${isEdit ? `${nowDisplay} (저장 시 자동 갱신)` : '최초 작성일시와 동일'}
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:14px;">
          <div class="form-group" style="margin-bottom:0;">
            <label>게시판 선택</label>
            <select id="formBoardSelect" class="select-control" style="width:100%;" ${isEdit ? 'disabled' : ''} onchange="App.handleFormBoardChange(this.value)">
              ${writableBoards
                .map(
                  (b) =>
                    `<option value="${b.id}" ${b.id === activeBoard.id ? 'selected' : ''}>${this.escapeHtml(b.name)}</option>`
                )
                .join('')}
            </select>
          </div>

          <div class="form-group" style="margin-bottom:0;">
            <label>카테고리 (말머리)</label>
            <select id="formCategorySelect" class="select-control" style="width:100%;">
              ${(activeBoard.categories || ['일반'])
                .map(
                  (c) =>
                    `<option value="${this.escapeHtml(c)}" ${editingPost && editingPost.category === c ? 'selected' : ''}>${this.escapeHtml(c)}</option>`
                )
                .join('')}
            </select>
          </div>
        </div>

        <div class="form-group">
          <label>제목 <span style="color:var(--danger);">*</span></label>
          <input
            type="text"
            id="formTitleInput"
            class="input-control"
            style="width:100%;"
            placeholder="게시글 제목을 입력하세요"
            value="${editingPost ? this.escapeHtml(editingPost.title) : ''}"
          />
        </div>

        <!-- 공지사항 등록 옵션 & 익명 작성 옵션 -->
        <div style="display:flex; gap:20px; margin-bottom:14px; padding:10px 14px; background:#f8fafc; border-radius:8px; border:1px solid var(--border); flex-wrap:wrap;">
          ${
            perms.canRegisterNotice
              ? `<label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-weight:600; color:#b45309;">
                   <input type="checkbox" id="formNoticeCheck" ${editingPost?.isNotice || activeBoard.type === 'NOTICE' ? 'checked' : ''} />
                   📢 상단 고정 공지사항으로 등록 (공지 등록자 / 공간 관리자 권한)
                 </label>`
              : ''
          }
          ${
            activeBoard.allowAnonymous
              ? `<label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-weight:600;">
                   <input type="checkbox" id="formAnonCheck" ${editingPost?.isAnonymous ? 'checked' : ''} />
                   🕵️ 익명으로 의견 작성 ('익명 학우'로 표시)
                 </label>`
              : ''
          }
        </div>

        <div class="form-group">
          <label>내용 <span style="color:var(--danger);">*</span></label>
          <textarea
            id="formContentInput"
            class="textarea-control"
            placeholder="학과 구성원과 공유할 공지사항이나 의견을 자세히 작성해 주세요."
          >${editingPost ? this.escapeHtml(editingPost.content) : ''}</textarea>
        </div>

        <!-- 첨부파일 업로드 및 관리 -->
        <div class="form-group">
          <label>📎 첨부파일 (양식 문서, 이미지, 자료 등 다중 파일 첨부 가능)</label>
          <div style="border:2px dashed var(--border); border-radius:8px; padding:14px; background:#f8fafc;">
            <input type="file" id="formAttachmentInput" multiple onchange="App.handleAttachmentUpload(event)" />
            <span style="font-size:12px; color:var(--text-muted); margin-left:8px;">
              * 첨부된 파일은 영구 저장소에 함께 보관되어 프로그램을 껐다 켜도 언제든 다운로드할 수 있습니다.
            </span>

            <div id="draftAttachmentList" style="margin-top:10px;">
              ${this.renderDraftAttachmentItems()}
            </div>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:18px;">
          <button class="btn btn-outline" onclick="App.cancelPostForm()">취소</button>
          <button class="btn btn-primary" onclick="App.handleSubmitPostForm()">
            ${isEdit ? '💾 수정 내용 저장 (수정일시 갱신)' : '✅ 게시글 등록하기'}
          </button>
        </div>
      </div>
    `;
  },

  handleFormBoardChange(boardId) {
    this.state.currentBoardId = boardId;
    this.renderPostFormView(document.getElementById('mainContentArea'));
  },

  renderDraftAttachmentItems() {
    if (!this.state.draftAttachments || this.state.draftAttachments.length === 0) {
      return `<div style="font-size:12.5px; color:var(--text-muted);">선택된 첨부파일이 없습니다.</div>`;
    }
    return this.state.draftAttachments
      .map(
        (att, i) => `
        <div class="attachment-item">
          <span>📎 <strong>${this.escapeHtml(att.fileName)}</strong> (${this.formatFileSize(att.fileSize)})</span>
          <button type="button" class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="App.removeDraftAttachment(${i})">삭제</button>
        </div>
      `
      )
      .join('');
  },

  handleAttachmentUpload(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.state.draftAttachments.push({
          id: 'att_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          uploadedAt: new Date().toISOString(),
          dataUrl: e.target.result
        });
        const listEl = document.getElementById('draftAttachmentList');
        if (listEl) listEl.innerHTML = this.renderDraftAttachmentItems();
      };
      reader.readAsDataURL(file);
    });
  },

  removeDraftAttachment(index) {
    this.state.draftAttachments.splice(index, 1);
    const listEl = document.getElementById('draftAttachmentList');
    if (listEl) listEl.innerHTML = this.renderDraftAttachmentItems();
  },

  cancelPostForm() {
    if (this.state.editingPostId) {
      this.state.currentView = 'POST_DETAIL';
    } else {
      this.state.currentView = 'BOARD_LIST';
    }
    this.renderMainContent();
  },

  async handleSubmitPostForm() {
    const boardEl = document.getElementById('formBoardSelect');
    const catEl = document.getElementById('formCategorySelect');
    const titleEl = document.getElementById('formTitleInput');
    const contentEl = document.getElementById('formContentInput');
    const noticeEl = document.getElementById('formNoticeCheck');
    const anonEl = document.getElementById('formAnonCheck');

    try {
      if (this.state.editingPostId) {
        const updated = await window.BoardService.updatePost(this.state.editingPostId, {
          category: catEl ? catEl.value : '일반',
          title: titleEl ? titleEl.value : '',
          content: contentEl ? contentEl.value : '',
          attachments: this.state.draftAttachments,
          isNotice: noticeEl ? noticeEl.checked : undefined,
          isAnonymous: anonEl ? anonEl.checked : undefined
        });
        this.showToast('게시글이 수정되었습니다 (수정일시 반영 완료).');
        this.state.selectedPostId = updated.id;
        this.state.currentView = 'POST_DETAIL';
      } else {
        const created = await window.BoardService.createPost({
          spaceId: this.state.currentSpaceId,
          boardId: boardEl ? boardEl.value : this.state.currentBoardId,
          category: catEl ? catEl.value : '일반',
          title: titleEl ? titleEl.value : '',
          content: contentEl ? contentEl.value : '',
          attachments: this.state.draftAttachments,
          isNotice: noticeEl ? noticeEl.checked : false,
          isAnonymous: anonEl ? anonEl.checked : false
        });
        this.showToast('새 게시글이 등록되고 영구 저장소에 기록되었습니다.');
        this.state.selectedPostId = created.id;
        this.state.currentView = 'POST_DETAIL';
      }
      this.renderAll();
    } catch (err) {
      alert(err.message);
    }
  },

  // 4-4. 내 게시글·댓글 통합 관리 화면 (일반 사용자 요구사항)
  openMyActivityView() {
    this.state.currentView = 'MY_ACTIVITY';
    this.renderAll();
  },

  renderMyActivityView(container) {
    const user = window.BoardService.getCurrentUser();
    const space = window.BoardService.db.spaces.find((s) => s.id === this.state.currentSpaceId);
    const { myPosts, myComments } = window.BoardService.getMyActivity(this.state.currentSpaceId);

    container.innerHTML = `
      <div class="panel-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid var(--border);">
          <div>
            <h2 style="font-size:19px; font-weight:800;">📝 내 게시글 및 댓글 통합 관리 (${this.escapeHtml(space.name)})</h2>
            <p style="font-size:13px; color:var(--text-muted);">
              ${this.escapeHtml(user.name)}님이 작성한 게시글과 댓글을 한눈에 확인하고 즉시 수정하거나 삭제할 수 있습니다.
            </p>
          </div>
          <button class="btn btn-outline" onclick="App.navigateToBoard('ALL')">← 게시판으로 돌아가기</button>
        </div>

        <!-- 내가 작성한 게시글 목록 -->
        <h3 style="font-size:15px; font-weight:700; margin-bottom:10px;">📌 내가 작성한 게시글 (${myPosts.length}건)</h3>
        <table class="post-table" style="margin-bottom:26px;">
          <thead>
            <tr>
              <th>제목</th>
              <th style="width:150px;">작성일시</th>
              <th style="width:150px;">수정일시</th>
              <th style="width:70px; text-align:center;">추천</th>
              <th style="width:160px; text-align:right;">관리</th>
            </tr>
          </thead>
          <tbody>
            ${
              myPosts.length === 0
                ? `<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--text-muted);">작성한 게시글이 없습니다.</td></tr>`
                : myPosts
                    .map(
                      (p) => `
                  <tr>
                    <td>
                      <a href="javascript:void(0)" style="font-weight:700; color:var(--primary); text-decoration:none;" onclick="App.openPostDetail('${p.id}')">
                        ${this.escapeHtml(p.title)}
                      </a>
                      ${p.isAnonymous ? '<span style="font-size:11px; color:var(--text-muted);">(익명작성)</span>' : ''}
                    </td>
                    <td style="font-size:12px;">${this.formatDateTime(p.createdAt)}</td>
                    <td style="font-size:12px;">${this.formatDateTime(p.updatedAt)}</td>
                    <td style="text-align:center;">👍 ${p.likeUserIds?.length || 0}</td>
                    <td style="text-align:right;">
                      <button class="btn btn-outline btn-sm" onclick="App.openPostEditForm('${p.id}')">수정</button>
                      <button class="btn btn-danger btn-sm" onclick="App.handleDeletePost('${p.id}')">삭제</button>
                    </td>
                  </tr>
                `
                    )
                    .join('')
            }
          </tbody>
        </table>

        <!-- 내가 작성한 댓글 목록 -->
        <h3 style="font-size:15px; font-weight:700; margin-bottom:10px;">💬 내가 작성한 댓글 (${myComments.length}건)</h3>
        <table class="post-table">
          <thead>
            <tr>
              <th>댓글 내용</th>
              <th style="width:240px;">원문 게시글</th>
              <th style="width:155px;">작성일시</th>
              <th style="width:130px; text-align:right;">관리</th>
            </tr>
          </thead>
          <tbody>
            ${
              myComments.length === 0
                ? `<tr><td colspan="4" style="text-align:center; padding:24px; color:var(--text-muted);">작성한 댓글이 없습니다.</td></tr>`
                : myComments
                    .map(
                      (c) => `
                  <tr>
                    <td>${this.escapeHtml(c.content)}</td>
                    <td style="font-size:12.5px; color:var(--text-muted);">
                      <a href="javascript:void(0)" onclick="App.openPostDetail('${c.postId}')">${this.escapeHtml(c.postTitle)}</a>
                    </td>
                    <td style="font-size:12px;">${this.formatDateTime(c.createdAt)}</td>
                    <td style="text-align:right;">
                      <button class="btn btn-outline btn-sm" onclick="App.openPostDetail('${c.postId}')">이동</button>
                      <button class="btn btn-danger btn-sm" onclick="App.handleDeleteComment('${c.id}')">삭제</button>
                    </td>
                  </tr>
                `
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>
    `;
  },

  // 4-5. 관리자 운영 및 문제 대응 센터 (게시물 관리자 & 공간 관리자 전용)
  openAdminCenter(tab = 'MODERATION') {
    this.state.adminTab = tab;
    this.state.currentView = 'ADMIN_CENTER';
    this.renderAll();
  },

  renderAdminCenterView(container) {
    const space = window.BoardService.db.spaces.find((s) => s.id === this.state.currentSpaceId);
    const perms = window.BoardService.getPermissions(this.state.currentSpaceId);

    if (!perms.canModerate) {
      container.innerHTML = `
        <div class="panel-card">
          <h3>관리자 권한이 필요합니다.</h3>
          <p style="margin-top:8px;">부적절한 게시물 관리자 또는 공간 관리자만 접근할 수 있습니다.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="panel-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <div>
            <h2 style="font-size:19px; font-weight:800;">🛡️ ${this.escapeHtml(space.name)} — 운영 및 문제 대응 관리 센터</h2>
            <p style="font-size:13px; color:var(--text-muted);">
              게시판이 목적에 맞게 운영되도록 관리하고, 부적절한 게시물이나 문제 발생 시 즉각 대응합니다.
            </p>
          </div>
          <button class="btn btn-outline" onclick="App.navigateToBoard('ALL')">← 게시판으로 돌아가기</button>
        </div>

        <div class="tab-bar">
          <button class="tab-btn ${this.state.adminTab === 'MODERATION' ? 'active' : ''}" onclick="App.openAdminCenter('MODERATION')">
            🚨 부적절 게시물 · 신고 대응 관리
          </button>
          <button class="tab-btn ${this.state.adminTab === 'BOARDS' ? 'active' : ''}" onclick="App.openAdminCenter('BOARDS')">
            📋 공간별 다중게시판 목적/설정 관리 ${perms.canManageSpace ? '' : '(공간관리자 전용)'}
          </button>
          <button class="tab-btn ${this.state.adminTab === 'MEMBERS' ? 'active' : ''}" onclick="App.openAdminCenter('MEMBERS')">
            👥 공간 구성원 및 5대 역할 관리
          </button>
        </div>

        <div id="adminTabBody">
          ${
            this.state.adminTab === 'MODERATION'
              ? this.renderAdminModerationTab(perms)
              : this.state.adminTab === 'BOARDS'
              ? this.renderAdminBoardsTab(perms)
              : this.renderAdminMembersTab(perms)
          }
        </div>
      </div>
    `;
  },

  renderAdminModerationTab(perms) {
    const reports = window.BoardService.db.reports.filter((r) => r.spaceId === this.state.currentSpaceId);
    const blindedPosts = window.BoardService.db.posts.filter(
      (p) => p.spaceId === this.state.currentSpaceId && p.isBlinded
    );

    return `
      <div>
        <h3 style="font-size:15px; font-weight:700; margin-bottom:10px;">🚨 접수된 신고 내역 (${reports.length}건)</h3>
        <table class="post-table" style="margin-bottom:24px;">
          <thead>
            <tr>
              <th style="width:90px;">상태</th>
              <th style="width:90px;">대상</th>
              <th>신고 사유</th>
              <th style="width:140px;">신고자</th>
              <th style="width:150px;">접수일시</th>
              <th style="width:210px; text-align:right;">문제 대응 조치</th>
            </tr>
          </thead>
          <tbody>
            ${
              reports.length === 0
                ? `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">접수된 신고 내역이 없습니다.</td></tr>`
                : reports
                    .map(
                      (r) => `
                  <tr>
                    <td>
                      <span class="role-badge ${r.status === 'PENDING' ? 'role-notice' : 'role-writer'}">
                        ${r.status === 'PENDING' ? '대기중' : '처리완료'}
                      </span>
                    </td>
                    <td>${r.targetType === 'POST' ? '게시글' : '댓글'}</td>
                    <td>${this.escapeHtml(r.reason)}</td>
                    <td>${this.escapeHtml(r.reporterName)}</td>
                    <td style="font-size:12px;">${this.formatDateTime(r.createdAt)}</td>
                    <td style="text-align:right;">
                      ${
                        r.targetType === 'POST'
                          ? `<button class="btn btn-outline btn-sm" onclick="App.openPostDetail('${r.targetId}')">원문 확인</button>
                             <button class="btn btn-warning btn-sm" onclick="App.handleQuickBlindFromReport('${r.id}', '${r.targetId}')">블라인드 처리</button>`
                          : ''
                      }
                      ${
                        r.status === 'PENDING'
                          ? `<button class="btn btn-primary btn-sm" onclick="App.handleResolveReport('${r.id}')">완료 표시</button>`
                          : ''
                      }
                    </td>
                  </tr>
                `
                    )
                    .join('')
            }
          </tbody>
        </table>

        <h3 style="font-size:15px; font-weight:700; margin-bottom:10px;">🚫 현재 블라인드(숨김) 처리된 게시글 (${blindedPosts.length}건)</h3>
        <table class="post-table">
          <thead>
            <tr>
              <th>제목</th>
              <th style="width:150px;">작성자</th>
              <th>블라인드 사유</th>
              <th style="width:220px; text-align:right;">복구 / 삭제 / 작성자 제재</th>
            </tr>
          </thead>
          <tbody>
            ${
              blindedPosts.length === 0
                ? `<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">블라인드 처리된 게시글이 없습니다.</td></tr>`
                : blindedPosts
                    .map(
                      (p) => `
                  <tr>
                    <td><strong>${this.escapeHtml(p.title)}</strong></td>
                    <td>${this.escapeHtml(p.authorName)}</td>
                    <td style="font-size:12.5px; color:#991b1b;">${this.escapeHtml(p.blindReason)}</td>
                    <td style="text-align:right;">
                      <button class="btn btn-outline btn-sm" onclick="App.handleToggleBlindPost('${p.id}')">블라인드 해제</button>
                      <button class="btn btn-warning btn-sm" onclick="App.handleRestrictAuthor('${p.authorId}')">작성자 읽기전용 강등</button>
                      <button class="btn btn-danger btn-sm" onclick="App.handleDeletePost('${p.id}')">완전 삭제</button>
                    </td>
                  </tr>
                `
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>
    `;
  },

  async handleQuickBlindFromReport(reportId, postId) {
    try {
      const post = window.BoardService.db.posts.find((p) => p.id === postId);
      if (post && !post.isBlinded) {
        await window.BoardService.toggleBlindPost(postId, '신고 접수에 따른 관리자 블라인드 조치');
      }
      await window.BoardService.resolveReport(reportId, '블라인드 조치 완료');
      this.showToast('해당 게시물을 블라인드 처리하고 신고를 완료 처리했습니다.');
      this.renderMainContent();
    } catch (err) {
      alert(err.message);
    }
  },

  async handleResolveReport(reportId) {
    try {
      await window.BoardService.resolveReport(reportId, '확인 및 조치 완료');
      this.showToast('신고 내역이 처리 완료되었습니다.');
      this.renderMainContent();
    } catch (err) {
      alert(err.message);
    }
  },

  async handleRestrictAuthor(authorId) {
    try {
      await window.BoardService.setMemberRole(this.state.currentSpaceId, authorId, 'READER');
      this.showToast('해당 사용자를 [① 게시글을 읽는 사람(읽기 전용)]으로 강등하여 글/댓글 작성을 제한했습니다.');
      this.renderAll();
    } catch (err) {
      alert(err.message);
    }
  },

  renderAdminBoardsTab(perms) {
    if (!perms.canManageSpace) {
      return `
        <div style="padding:24px; background:#f8fafc; border-radius:8px; color:var(--text-muted);">
          🔒 게시판 생성·수정·삭제는 <strong>[⑤ 게시판이나 운영공간을 관리하는 사람 (공간 관리자)]</strong> 전용 기능입니다.<br/>
          상단 바에서 <strong>⑤ 게시판·공간 관리자 (학과조교)</strong> 계정으로 전환하시면 모든 게시판을 설정할 수 있습니다.
        </div>
      `;
    }

    const boards = window.BoardService.getBoardsBySpace(this.state.currentSpaceId);
    return `
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3 style="font-size:15px; font-weight:700;">📋 운영 공간 내 다중게시판 목록 (${boards.length}개)</h3>
          <button class="btn btn-primary" onclick="App.openBoardModal()">+ 새 게시판 추가</button>
        </div>

        <table class="post-table">
          <thead>
            <tr>
              <th>게시판 이름</th>
              <th>유형</th>
              <th>작성 허용 권한</th>
              <th>익명 의견 허용</th>
              <th>카테고리(말머리)</th>
              <th style="text-align:right;">관리</th>
            </tr>
          </thead>
          <tbody>
            ${boards
              .map(
                (b) => `
              <tr>
                <td>
                  <strong>${this.escapeHtml(b.name)}</strong>
                  <div style="font-size:12px; color:var(--text-muted);">${this.escapeHtml(b.description)}</div>
                </td>
                <td><span class="badge-cat">${b.type}</span></td>
                <td>${b.writePermission === 'NOTICE_ONLY' ? '📢 공지 등록자/관리자만' : '✍️ 작성권한자 이상 모두'}</td>
                <td>${b.allowAnonymous ? '✅ 허용' : '❌ 비허용'}</td>
                <td style="font-size:12px;">${(b.categories || []).map((c) => this.escapeHtml(c)).join(', ')}</td>
                <td style="text-align:right;">
                  <button class="btn btn-outline btn-sm" onclick="App.openBoardModal('${b.id}')">설정 수정</button>
                  <button class="btn btn-danger btn-sm" onclick="App.handleDeleteBoard('${b.id}')">삭제</button>
                </td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  async handleDeleteBoard(boardId) {
    if (!confirm('이 게시판과 소속 게시글을 삭제하시겠습니까?')) return;
    try {
      await window.BoardService.deleteBoard(this.state.currentSpaceId, boardId);
      if (this.state.currentBoardId === boardId) this.state.currentBoardId = 'ALL';
      this.showToast('게시판이 삭제되었습니다.');
      this.renderAll();
    } catch (err) {
      alert(err.message);
    }
  },

  renderAdminMembersTab(perms) {
    const members = window.BoardService.db.spaceMembers.filter(
      (sm) => sm.spaceId === this.state.currentSpaceId && sm.status === 'ACTIVE'
    );
    const allUsers = window.BoardService.db.users;
    const nonMembers = allUsers.filter((u) => !members.some((m) => m.userId === u.id));
    const roleMetas = window.BoardService.getAllRoleMetas();

    return `
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
          <h3 style="font-size:15px; font-weight:700;">👥 현재 학과 공간 소속 구성원 및 5대 역할 관리 (${members.length}명)</h3>
          ${
            perms.canManageSpace && nonMembers.length > 0
              ? `<div style="display:flex; gap:6px; align-items:center;">
                   <select id="inviteUserSelect" class="select-control">
                     ${nonMembers.map((u) => `<option value="${u.id}">${this.escapeHtml(u.name)} (${this.escapeHtml(u.username)})</option>`).join('')}
                   </select>
                   <select id="inviteRoleSelect" class="select-control">
                     ${roleMetas.map((r) => `<option value="${r.code}" ${r.code === 'WRITER' ? 'selected' : ''}>${r.label}</option>`).join('')}
                   </select>
                   <button class="btn btn-primary btn-sm" onclick="App.handleInviteMember()">+ 공간 구성원으로 추가(접근 허용)</button>
                 </div>`
              : ''
          }
        </div>

        <table class="post-table">
          <thead>
            <tr>
              <th>이름 (아이디)</th>
              <th>학번/교번</th>
              <th>현재 부여된 역할 (5단계)</th>
              <th>역할 변경 / 제재 관리</th>
            </tr>
          </thead>
          <tbody>
            ${members
              .map((sm) => {
                const u = allUsers.find((usr) => usr.id === sm.userId);
                if (!u) return '';
                const rm = window.BoardService.getRoleMeta(sm.role);
                return `
                  <tr>
                    <td><strong>${this.escapeHtml(u.name)}</strong> (${this.escapeHtml(u.username)})</td>
                    <td>${this.escapeHtml(u.studentId || '-')}</td>
                    <td><span class="role-badge ${rm.badgeClass}">${rm.label}</span></td>
                    <td>
                      ${
                        perms.canManageSpace
                          ? `<div style="display:flex; gap:6px; align-items:center;">
                               <select class="select-control" onchange="App.handleChangeMemberRole('${u.id}', this.value)">
                                 ${roleMetas
                                   .map(
                                     (r) =>
                                       `<option value="${r.code}" ${r.code === sm.role ? 'selected' : ''}>${r.label}</option>`
                                   )
                                   .join('')}
                               </select>
                               <button class="btn btn-danger btn-sm" onclick="App.handleRemoveMember('${u.id}')">공간 퇴출(접근차단)</button>
                             </div>`
                          : `<button class="btn btn-warning btn-sm" onclick="App.handleRestrictAuthor('${u.id}')">글쓰기 제한(읽기전용 강등)</button>`
                      }
                    </td>
                  </tr>
                `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  async handleChangeMemberRole(userId, newRole) {
    try {
      await window.BoardService.setMemberRole(this.state.currentSpaceId, userId, newRole);
      this.showToast('구성원의 역할이 변경되고 영구 저장소에 반영되었습니다.');
      this.renderAll();
    } catch (err) {
      alert(err.message);
    }
  },

  async handleInviteMember() {
    const userSel = document.getElementById('inviteUserSelect');
    const roleSel = document.getElementById('inviteRoleSelect');
    if (!userSel || !roleSel) return;
    try {
      await window.BoardService.setMemberRole(this.state.currentSpaceId, userSel.value, roleSel.value);
      this.showToast('해당 사용자를 현재 학과 공간 구성원으로 추가했습니다.');
      this.renderAll();
    } catch (err) {
      alert(err.message);
    }
  },

  async handleRemoveMember(userId) {
    if (!confirm('이 구성원을 현재 학과 공간에서 퇴출(접근 차단)하시겠습니까?')) return;
    try {
      await window.BoardService.removeMemberFromSpace(this.state.currentSpaceId, userId);
      this.showToast('해당 사용자가 공간에서 퇴출되어 접근이 차단되었습니다.');
      this.renderAll();
    } catch (err) {
      alert(err.message);
    }
  },

  // 5. 모달 다이얼로그 제어 (로그인/회원가입, 공간 생성, 게시판 생성/수정, 신고, 게시글 이동)
  openModal(htmlContent) {
    const backdrop = document.getElementById('modalBackdrop');
    const box = document.getElementById('modalContentBox');
    if (!backdrop || !box) return;
    box.innerHTML = htmlContent;
    backdrop.classList.add('open');
  },

  closeModal() {
    const backdrop = document.getElementById('modalBackdrop');
    if (backdrop) backdrop.classList.remove('open');
  },

  // 5-1. 로그인 및 회원가입 모달 (학과 선택 + 특정 인증 코드로 조교·모더레이터·교수 가입 지원)
  openAuthModal(mode = 'LOGIN') {
    const spaces = window.BoardService.db.spaces;
    const defaultSpaceId = this.state.currentSpaceId || (spaces[0] && spaces[0].id);
    const codeGuide = window.BoardService.getSpaceRoleCodeGuide(defaultSpaceId);

    this.openModal(`
      <div class="modal-header">
        <h3>${mode === 'LOGIN' ? '🔐 로그인' : '✨ 학과 선택 및 직책 코드 회원가입'}</h3>
        <button class="btn btn-outline btn-sm" onclick="App.closeModal()">닫기</button>
      </div>

      <div class="tab-bar">
        <button class="tab-btn ${mode === 'LOGIN' ? 'active' : ''}" onclick="App.openAuthModal('LOGIN')">로그인</button>
        <button class="tab-btn ${mode === 'REGISTER' ? 'active' : ''}" onclick="App.openAuthModal('REGISTER')">신규 회원가입 (학과·직책코드)</button>
      </div>

      ${
        mode === 'LOGIN'
          ? `
            <div class="form-group">
              <label>아이디</label>
              <input type="text" id="authLoginUsername" class="input-control" style="width:100%;" placeholder="예: writer01, admin_cse, admin_dsn, admin_biz" value="writer01" />
            </div>
            <div class="form-group">
              <label>비밀번호</label>
              <input type="password" id="authLoginPassword" class="input-control" style="width:100%;" value="password123" />
            </div>
            <div style="font-size:12px; color:var(--text-muted); margin-bottom:14px; background:#f8fafc; padding:10px; border-radius:8px; border:1px solid var(--border);">
              <div><strong>📌 과별 조교 및 기본 테스트 계정 안내 (비밀번호 공통: <code>password123</code>)</strong></div>
              <div style="margin-top:4px;">• 컴퓨터공학과 조교: <code>admin_cse</code> / 교수: <code>prof_cse</code> / 모더레이터: <code>mod_cse</code></div>
              <div>• 디자인학과 조교: <code>admin_dsn</code> (디자인학과 권한만 보유)</div>
              <div>• 경영학과 조교: <code>admin_biz</code> (경영학과 권한만 보유)</div>
            </div>
            <button class="btn btn-primary" style="width:100%;" onclick="App.submitLogin()">로그인</button>
          `
          : `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
              <div class="form-group">
                <label>아이디 <span style="color:var(--danger);">*</span></label>
                <input type="text" id="regUsername" class="input-control" style="width:100%;" placeholder="예: ta_cse02" />
              </div>
              <div class="form-group">
                <label>비밀번호 <span style="color:var(--danger);">*</span></label>
                <input type="password" id="regPassword" class="input-control" style="width:100%;" placeholder="비밀번호 입력" value="password123" />
              </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
              <div class="form-group">
                <label>이름 (성명) <span style="color:var(--danger);">*</span></label>
                <input type="text" id="regName" class="input-control" style="width:100%;" placeholder="예: 홍길동" />
              </div>
              <div class="form-group">
                <label>학번 / 교번 (선택)</label>
                <input type="text" id="regStudentId" class="input-control" style="width:100%;" placeholder="예: 20260019 / STAFF-02" />
              </div>
            </div>

            <div class="form-group">
              <label>① 소속 학과 선택 (운영 공간) <span style="color:var(--danger);">*</span></label>
              <select id="regSpaceId" class="select-control" style="width:100%;" onchange="App.onRegisterSpaceOrRoleChange()">
                ${spaces
                  .map(
                    (s) =>
                      `<option value="${s.id}" ${s.id === defaultSpaceId ? 'selected' : ''}>${s.icon || '🏛️'} ${this.escapeHtml(s.name)} (담당: ${this.escapeHtml(s.assistantName || '학과조교')})</option>`
                  )
                  .join('')}
              </select>
              <div style="font-size:11.5px; color:#1e40af; margin-top:4px;">
                * 가입 시 선택한 학과에만 소속되며, <strong>조교로 가입하더라도 오직 선택한 자기 학과 권한만 부여</strong>됩니다.
              </div>
            </div>

            <div class="form-group">
              <label>② 가입 희망 역할 선택 (또는 아래 인증 코드 입력 시 자동 지정)</label>
              <select id="regRole" class="select-control" style="width:100%;" onchange="App.onRegisterSpaceOrRoleChange()">
                <option value="WRITER" selected>✍️ 일반 재학생 — 게시글·댓글을 작성하는 사람 (코드 불필요)</option>
                <option value="READER">👀 신입생/준회원 — 게시글을 읽는 사람 (코드 불필요)</option>
                <option value="SPACE_ADMIN">👑 학과 조교 — 게시판·운영공간을 관리하는 사람 (조교 코드 필수)</option>
                <option value="MODERATOR">🛡️ 모더레이터 — 부적절한 게시물을 관리하는 사람 (모더레이터 코드 필수)</option>
                <option value="NOTICE_MANAGER">📢 교수 — 공지사항을 등록하는 사람 (교수 코드 필수)</option>
              </select>
            </div>

            <div class="form-group" style="background:#f8fafc; padding:12px; border-radius:8px; border:1px solid var(--border);">
              <label style="display:flex; justify-content:space-between; align-items:center;">
                <span>🔑 특정 직책 인증 코드 (조교 · 모더레이터 · 교수 가입용)</span>
                <span style="font-size:11px; color:var(--primary); font-weight:600;">클릭 시 자동 입력</span>
              </label>
              <input
                type="text"
                id="regRoleCode"
                class="input-control"
                style="width:100%; margin-top:4px;"
                placeholder="일반 학생은 비워두세요. 코드 입력 시 조교/모더레이터/교수로 즉시 가입됩니다."
                oninput="App.onRegisterCodeInput()"
              />
              <div id="regCodeQuickBox" style="margin-top:8px; font-size:12px;">
                ${this.buildRegisterCodeGuideHtml(codeGuide)}
              </div>
            </div>

            <button class="btn btn-primary" style="width:100%;" onclick="App.submitRegister()">회원가입 및 선택한 학과로 즉시 로그인</button>
          `
      }
    `);
  },

  buildRegisterCodeGuideHtml(codeGuide) {
    return `
      <div style="margin-bottom:6px; color:var(--text-muted);">
        💡 <strong>${this.escapeHtml(codeGuide.spaceName)}</strong> 전용 직책 코드 (버튼을 누르면 코드가 자동 입력됩니다):
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        <button type="button" class="btn btn-outline btn-sm" onclick="App.fillRegisterRoleCode('SPACE_ADMIN', '${codeGuide.codes.SPACE_ADMIN.deptCode}')">
          👑 조교 가입코드: <code>${codeGuide.codes.SPACE_ADMIN.deptCode}</code>
        </button>
        <button type="button" class="btn btn-outline btn-sm" onclick="App.fillRegisterRoleCode('MODERATOR', '${codeGuide.codes.MODERATOR.deptCode}')">
          🛡️ 모더레이터 코드: <code>${codeGuide.codes.MODERATOR.deptCode}</code>
        </button>
        <button type="button" class="btn btn-outline btn-sm" onclick="App.fillRegisterRoleCode('NOTICE_MANAGER', '${codeGuide.codes.NOTICE_MANAGER.deptCode}')">
          📢 교수 가입코드: <code>${codeGuide.codes.NOTICE_MANAGER.deptCode}</code>
        </button>
        <button type="button" class="btn btn-outline btn-sm" onclick="App.fillRegisterRoleCode('WRITER', '')">
          ✍️ 일반 학생 (코드 해제)
        </button>
      </div>
      <div style="margin-top:6px; font-size:11px; color:var(--text-muted);">
        * 공통 코드(<code>ADMIN-2026</code>, <code>MOD-2026</code>, <code>PROF-2026</code>) 또는 학과별 코드를 입력하면 해당 학과의 조교·모더레이터·교수로 가입됩니다.
      </div>
    `;
  },

  onRegisterSpaceOrRoleChange() {
    const spaceId = document.getElementById('regSpaceId')?.value;
    const roleSelect = document.getElementById('regRole');
    const codeInput = document.getElementById('regRoleCode');
    const quickBox = document.getElementById('regCodeQuickBox');
    if (!spaceId) return;

    const guide = window.BoardService.getSpaceRoleCodeGuide(spaceId);
    if (quickBox) {
      quickBox.innerHTML = this.buildRegisterCodeGuideHtml(guide);
    }

    if (roleSelect && codeInput) {
      const selectedRole = roleSelect.value;
      if (['SPACE_ADMIN', 'MODERATOR', 'NOTICE_MANAGER'].includes(selectedRole)) {
        codeInput.value = guide.codes[selectedRole].deptCode;
      } else if (['WRITER', 'READER'].includes(selectedRole)) {
        codeInput.value = '';
      }
    }
  },

  fillRegisterRoleCode(roleCode, authCodeStr) {
    const roleSelect = document.getElementById('regRole');
    const codeInput = document.getElementById('regRoleCode');
    if (roleSelect) roleSelect.value = roleCode;
    if (codeInput) codeInput.value = authCodeStr;
  },

  onRegisterCodeInput() {
    const spaceId = document.getElementById('regSpaceId')?.value;
    const codeInput = document.getElementById('regRoleCode');
    const roleSelect = document.getElementById('regRole');
    if (!spaceId || !codeInput || !roleSelect) return;

    const raw = codeInput.value.trim().toUpperCase();
    if (!raw) return;

    try {
      const matchedRole = window.BoardService.resolveRoleByAuthCode(spaceId, raw, roleSelect.value);
      if (matchedRole) {
        roleSelect.value = matchedRole;
      }
    } catch (_) {
      // 입력 중일 때는 무시
    }
  },

  submitLogin() {
    const u = document.getElementById('authLoginUsername')?.value;
    const p = document.getElementById('authLoginPassword')?.value;
    try {
      const user = window.BoardService.login(u, p);
      const mySm = window.BoardService.db.spaceMembers.find(
        (sm) => sm.userId === user.id && sm.status === 'ACTIVE'
      );
      if (mySm) {
        this.state.currentSpaceId = mySm.spaceId;
      }
      this.closeModal();
      this.showToast(`환영합니다, ${user.name}님!`);
      this.renderAll();
    } catch (err) {
      alert(err.message);
    }
  },

  async submitRegister() {
    try {
      const username = document.getElementById('regUsername')?.value;
      const password = document.getElementById('regPassword')?.value;
      const name = document.getElementById('regName')?.value;
      const studentId = document.getElementById('regStudentId')?.value;
      const spaceId = document.getElementById('regSpaceId')?.value;
      const initialRole = document.getElementById('regRole')?.value;
      const roleCode = document.getElementById('regRoleCode')?.value;

      const result = await window.BoardService.register({
        username,
        password,
        name,
        studentId,
        spaceId,
        initialRole,
        roleCode
      });
      const newUser = result.user || result;
      const roleMeta = window.BoardService.getRoleMeta(result.assignedRole || initialRole);

      this.state.currentSpaceId = spaceId;
      this.state.currentBoardId = 'ALL';
      this.state.currentView = 'BOARD_LIST';
      this.closeModal();
      this.showToast(
        `회원가입 완료! '${newUser.name}' (${result.space ? result.space.name : ''} · ${roleMeta.shortLabel}) 계정으로 로그인되었습니다.`
      );
      this.renderAll();
    } catch (err) {
      alert(err.message);
    }
  },

  // 5-2. 새 학과 운영 공간 추가 모달
  openCreateSpaceModal() {
    this.openModal(`
      <div class="modal-header">
        <h3>🏛️ 새 운영 공간(학과) 개설</h3>
        <button class="btn btn-outline btn-sm" onclick="App.closeModal()">닫기</button>
      </div>
      <div class="form-group">
        <label>학과(운영 공간) 이름 <span style="color:var(--danger);">*</span></label>
        <input type="text" id="newSpaceName" class="input-control" style="width:100%;" placeholder="예: 전자공학과, 인공지능학과" />
      </div>
      <div class="form-group">
        <label>공간 아이콘</label>
        <input type="text" id="newSpaceIcon" class="input-control" style="width:100%;" value="🎓" />
      </div>
      <div class="form-group">
        <label>공간 소개</label>
        <input type="text" id="newSpaceDesc" class="input-control" style="width:100%;" placeholder="학과 공지 및 의견 공유 공간 설명" />
      </div>
      <p style="font-size:12px; color:var(--text-muted); margin-bottom:14px;">
        * 새 공간을 만들면 공지사항, 건의/의견 게시판, 자유 소통 게시판 3개가 기본 생성되며, 타 공간 사용자로부터 자동 격리됩니다.
      </p>
      <button class="btn btn-primary" style="width:100%;" onclick="App.submitCreateSpace()">공간 생성하기</button>
    `);
  },

  async submitCreateSpace() {
    try {
      const name = document.getElementById('newSpaceName')?.value;
      const icon = document.getElementById('newSpaceIcon')?.value;
      const description = document.getElementById('newSpaceDesc')?.value;
      const space = await window.BoardService.createSpace({ name, icon, description });
      this.closeModal();
      this.selectSpace(space.id);
      this.showToast(`'${space.name}' 공간과 기본 다중게시판이 생성되었습니다.`);
    } catch (err) {
      alert(err.message);
    }
  },

  // 5-3. 게시판 추가/수정 모달 (공간 관리자용)
  openBoardModal(boardId = null) {
    const board = boardId
      ? window.BoardService.db.boards.find((b) => b.id === boardId)
      : null;

    this.openModal(`
      <div class="modal-header">
        <h3>${board ? '⚙️ 게시판 설정 수정' : '📋 새 게시판 생성'}</h3>
        <button class="btn btn-outline btn-sm" onclick="App.closeModal()">닫기</button>
      </div>

      <div class="form-group">
        <label>게시판 이름 <span style="color:var(--danger);">*</span></label>
        <input type="text" id="modalBoardName" class="input-control" style="width:100%;" value="${board ? this.escapeHtml(board.name) : ''}" placeholder="예: 졸업작품 공지 게시판, 실습실 건의함" />
      </div>

      <div class="form-group">
        <label>게시판 목적 및 설명</label>
        <input type="text" id="modalBoardDesc" class="input-control" style="width:100%;" value="${board ? this.escapeHtml(board.description) : ''}" placeholder="게시판 운영 목적 입력" />
      </div>

      <div class="form-group">
        <label>게시판 유형</label>
        <select id="modalBoardType" class="select-control" style="width:100%;">
          <option value="NOTICE" ${board?.type === 'NOTICE' ? 'selected' : ''}>📢 공지사항 게시판 (NOTICE)</option>
          <option value="OPINION" ${board?.type === 'OPINION' ? 'selected' : ''}>💡 건의 및 의견 공유 게시판 (OPINION)</option>
          <option value="GENERAL" ${!board || board?.type === 'GENERAL' ? 'selected' : ''}>💬 자유 소통 / Q&A 게시판 (GENERAL)</option>
          <option value="ARCHIVE" ${board?.type === 'ARCHIVE' ? 'selected' : ''}>📁 학사 양식 / 자료실 (ARCHIVE)</option>
        </select>
      </div>

      <div class="form-group">
        <label>게시글 작성 허용 권한</label>
        <select id="modalBoardPerm" class="select-control" style="width:100%;">
          <option value="WRITER_UP" ${!board || board?.writePermission === 'WRITER_UP' ? 'selected' : ''}>✍️ 작성하는 사람(일반 구성원) 이상 모두 작성 가능</option>
          <option value="NOTICE_ONLY" ${board?.writePermission === 'NOTICE_ONLY' ? 'selected' : ''}>📢 공지사항을 등록하는 사람 & 공간 관리자만 작성 가능</option>
        </select>
      </div>

      <div class="form-group">
        <label>말머리 (카테고리, 쉼표로 구분)</label>
        <input type="text" id="modalBoardCats" class="input-control" style="width:100%;" value="${board ? this.escapeHtml((board.categories || []).join(', ')) : '일반, 건의, 질문'}" />
      </div>

      <div class="form-group">
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
          <input type="checkbox" id="modalBoardAnon" ${!board || board?.allowAnonymous ? 'checked' : ''} />
          🕵️ 익명 의견 작성 허용
        </label>
      </div>

      <button class="btn btn-primary" style="width:100%;" onclick="App.submitBoardModal('${board ? board.id : ''}')">
        ${board ? '설정 저장' : '게시판 생성'}
      </button>
    `);
  },

  async submitBoardModal(boardId) {
    try {
      const payload = {
        name: document.getElementById('modalBoardName')?.value,
        description: document.getElementById('modalBoardDesc')?.value,
        type: document.getElementById('modalBoardType')?.value,
        writePermission: document.getElementById('modalBoardPerm')?.value,
        categories: document.getElementById('modalBoardCats')?.value,
        allowAnonymous: document.getElementById('modalBoardAnon')?.checked
      };

      if (boardId) {
        await window.BoardService.updateBoard(this.state.currentSpaceId, boardId, payload);
        this.showToast('게시판 설정이 수정되었습니다.');
      } else {
        await window.BoardService.createBoard(this.state.currentSpaceId, payload);
        this.showToast('새 게시판이 추가되었습니다.');
      }
      this.closeModal();
      this.renderAll();
    } catch (err) {
      alert(err.message);
    }
  },

  // 5-4. 부적절 게시물 신고 모달
  openReportModal(targetType, targetId) {
    this.openModal(`
      <div class="modal-header">
        <h3>🚨 부적절한 게시물 신고</h3>
        <button class="btn btn-outline btn-sm" onclick="App.closeModal()">닫기</button>
      </div>
      <div class="form-group">
        <label>신고 사유 선택 또는 입력</label>
        <textarea id="reportReasonInput" class="textarea-control" style="min-height:110px;" placeholder="욕설/비방, 스팸 홍보, 게시판 목적 위반 등 구체적인 신고 사유를 입력해 주세요."></textarea>
      </div>
      <button class="btn btn-danger" style="width:100%;" onclick="App.submitReport('${targetType}', '${targetId}')">
        관리자에게 신고 접수
      </button>
    `);
  },

  async submitReport(targetType, targetId) {
    try {
      const reason = document.getElementById('reportReasonInput')?.value;
      await window.BoardService.reportContent({
        spaceId: this.state.currentSpaceId,
        targetType,
        targetId,
        reason
      });
      this.closeModal();
      this.showToast('신고가 접수되어 게시물 관리자에게 알림이 전송되었습니다.');
      this.renderHeader();
    } catch (err) {
      alert(err.message);
    }
  },

  // 5-5. 게시글 타 게시판 이동 모달 (관리자용)
  openMovePostModal(postId) {
    const post = window.BoardService.db.posts.find((p) => p.id === postId);
    if (!post) return;
    const boards = window.BoardService.getBoardsBySpace(post.spaceId);

    this.openModal(`
      <div class="modal-header">
        <h3>📂 게시글 다른 게시판으로 이동</h3>
        <button class="btn btn-outline btn-sm" onclick="App.closeModal()">닫기</button>
      </div>
      <p style="font-size:13px; color:var(--text-muted); margin-bottom:12px;">
        게시판 목적에 맞지 않게 작성된 글을 알맞은 게시판으로 이동시킵니다.
      </p>
      <div class="form-group">
        <label>이동할 대상 게시판 선택</label>
        <select id="moveTargetBoardSelect" class="select-control" style="width:100%;">
          ${boards
            .map(
              (b) =>
                `<option value="${b.id}" ${b.id === post.boardId ? 'selected' : ''}>${this.escapeHtml(b.name)}</option>`
            )
            .join('')}
        </select>
      </div>
      <button class="btn btn-primary" style="width:100%;" onclick="App.submitMovePost('${post.id}')">
        게시글 이동 실행
      </button>
    `);
  },

  async submitMovePost(postId) {
    try {
      const targetBoardId = document.getElementById('moveTargetBoardSelect')?.value;
      await window.BoardService.movePost(postId, targetBoardId);
      this.closeModal();
      this.showToast('게시글이 선택한 게시판으로 이동되었습니다.');
      this.renderAll();
    } catch (err) {
      alert(err.message);
    }
  },

  // 6. 백업 / 복원 / 초기화
  exportBackup() {
    window.StorageManager.exportJsonBackup();
    this.showToast('전체 데이터(첨부파일 포함) 백업 파일이 다운로드되었습니다.');
  },

  async importBackup(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      await window.StorageManager.importJsonBackup(text);
      this.showToast('백업 데이터가 성공적으로 복원되었습니다.');
      this.renderAll();
    } catch (err) {
      alert('백업 파일 복원 실패: ' + err.message);
    } finally {
      event.target.value = '';
    }
  },

  async resetDatabase() {
    if (!confirm('모든 데이터를 초기 샘플 상태로 되돌리시겠습니까?')) return;
    await window.StorageManager.resetToDefault();
    this.state.currentSpaceId = 'space_cse';
    this.state.currentBoardId = 'ALL';
    this.state.currentView = 'BOARD_LIST';
    this.showToast('초기 샘플 데이터 상태로 리셋되었습니다.');
    this.renderAll();
  }
};

window.App = App;
window.addEventListener('DOMContentLoaded', () => App.init());
