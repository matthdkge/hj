/**
 * service.js
 * 학과별 복합 다중게시판 비즈니스 로직, 공간 간 접근 차단 가드, 5단계 역할 권한 제어(RBAC)
 */

const ROLE_META = {
  READER: {
    code: 'READER',
    label: '게시글을 읽는 사람',
    shortLabel: '읽기 전용',
    badgeClass: 'role-reader',
    description: '게시글·댓글 열람, 검색, 첨부파일 다운로드만 가능 (작성 불가)'
  },
  WRITER: {
    code: 'WRITER',
    label: '게시글·댓글을 작성하는 사람',
    shortLabel: '일반 작성자',
    badgeClass: 'role-writer',
    description: '게시글 및 댓글 작성, 본인 글/댓글 수정·삭제, 추천 및 신고 가능'
  },
  NOTICE_MANAGER: {
    code: 'NOTICE_MANAGER',
    label: '공지사항을 등록하는 사람',
    shortLabel: '공지 등록자',
    badgeClass: 'role-notice',
    description: '일반 작성 권한 + 공지 전용 게시판 작성 및 상단 고정 공지 등록 가능'
  },
  MODERATOR: {
    code: 'MODERATOR',
    label: '부적절한 게시물을 관리하는 사람',
    shortLabel: '게시물 관리자',
    badgeClass: 'role-moderator',
    description: '타인의 부적절한 게시글·댓글 블라인드/강제 삭제, 신고 처리, 문제 사용자 작성 제한'
  },
  SPACE_ADMIN: {
    code: 'SPACE_ADMIN',
    label: '게시판·운영공간을 관리하는 사람',
    shortLabel: '공간·게시판 관리자',
    badgeClass: 'role-admin',
    description: '공간 내 다중게시판 생성·수정·삭제, 구성원 승인/강퇴 및 5대 역할 부여, 전체 관리 권한'
  }
};

const BoardService = {
  get db() {
    return window.StorageManager.db;
  },

  getRoleMeta(roleCode) {
    return ROLE_META[roleCode] || ROLE_META.READER;
  },

  getAllRoleMetas() {
    return Object.values(ROLE_META);
  },

  // 현재 로그인한 사용자 반환
  getCurrentUser() {
    const userId = window.StorageManager.getSessionUserId();
    if (!userId) return null;
    return this.db.users.find((u) => u.id === userId) || null;
  },

  // 학과별 직책(조교/모더레이터/교수) 가입 인증 코드 안내 조회
  getSpaceRoleCodeGuide(spaceId) {
    const space = this.db.spaces.find((s) => s.id === spaceId) || this.db.spaces[0];
    const codePrefix = (space && space.code ? space.code : 'DEPT').toUpperCase();
    const roleCodes = (space && space.roleCodes) || {
      SPACE_ADMIN: `${codePrefix}-ADMIN`,
      MODERATOR: `${codePrefix}-MOD`,
      NOTICE_MANAGER: `${codePrefix}-PROF`
    };
    return {
      spaceId: space ? space.id : '',
      spaceName: space ? space.name : '학과',
      codePrefix,
      codes: {
        SPACE_ADMIN: {
          deptCode: roleCodes.SPACE_ADMIN || `${codePrefix}-ADMIN`,
          commonCode: 'ADMIN-2026',
          label: '조교 (해당 학과 게시판·운영공간 관리자)'
        },
        MODERATOR: {
          deptCode: roleCodes.MODERATOR || `${codePrefix}-MOD`,
          commonCode: 'MOD-2026',
          label: '모더레이터 (부적절 게시물 관리자)'
        },
        NOTICE_MANAGER: {
          deptCode: roleCodes.NOTICE_MANAGER || `${codePrefix}-PROF`,
          commonCode: 'PROF-2026',
          label: '교수 (공지사항 등록 담당자)'
        }
      }
    };
  },

  // 입력된 특정 인증 코드로부터 역할(조교/모더레이터/교수) 판별 및 검증
  resolveRoleByAuthCode(spaceId, rawCode, requestedRole = 'WRITER') {
    const guide = this.getSpaceRoleCodeGuide(spaceId);
    const input = (rawCode || '').trim().toUpperCase();

    const adminAcceptable = [
      guide.codes.SPACE_ADMIN.deptCode.toUpperCase(),
      'ADMIN-2026',
      'TA-2026',
      '조교코드',
      '조교'
    ];
    const modAcceptable = [
      guide.codes.MODERATOR.deptCode.toUpperCase(),
      'MOD-2026',
      '모더레이터코드',
      '모더레이터'
    ];
    const profAcceptable = [
      guide.codes.NOTICE_MANAGER.deptCode.toUpperCase(),
      'PROF-2026',
      '교수코드',
      '교수'
    ];

    // 1) 인증 코드가 입력된 경우: 코드에 맞는 직책(조교/모더레이터/교수) 자동 매칭
    if (input) {
      if (adminAcceptable.includes(input)) {
        return 'SPACE_ADMIN';
      }
      if (modAcceptable.includes(input)) {
        return 'MODERATOR';
      }
      if (profAcceptable.includes(input)) {
        return 'NOTICE_MANAGER';
      }
      throw new Error(
        `유효하지 않은 직책 인증 코드입니다.\n` +
        `[${guide.spaceName} 전용 가입 코드 안내]\n` +
        `• 조교(학과 관리자): ${guide.codes.SPACE_ADMIN.deptCode} (또는 ADMIN-2026)\n` +
        `• 모더레이터(게시물 관리): ${guide.codes.MODERATOR.deptCode} (또는 MOD-2026)\n` +
        `• 교수(공지 등록자): ${guide.codes.NOTICE_MANAGER.deptCode} (또는 PROF-2026)`
      );
    }

    // 2) 인증 코드가 비어있는데 조교/모더레이터/교수를 선택한 경우: 코드 입력 안내
    if (['SPACE_ADMIN', 'MODERATOR', 'NOTICE_MANAGER'].includes(requestedRole)) {
      const targetInfo = guide.codes[requestedRole];
      throw new Error(
        `${targetInfo.label} 역할로 가입하려면 인증 코드를 입력해야 합니다.\n` +
        `인증 코드란에 '${targetInfo.deptCode}' 또는 '${targetInfo.commonCode}'를 입력해 주세요.`
      );
    }

    return ROLE_META[requestedRole] ? requestedRole : 'WRITER';
  },

  // 회원가입 (학과 선택 + 특정 코드로 조교/모더레이터/교수 가입, 조교는 자기 학과 권한만 부여)
  async register({ username, password, name, studentId, email, spaceId, initialRole = 'WRITER', roleCode = '' }) {
    if (!username || !password || !name) {
      throw new Error('아이디, 비밀번호, 이름은 필수 입력 항목입니다.');
    }
    if (!spaceId) {
      throw new Error('소속 학과(운영 공간)를 선택해 주세요.');
    }
    const cleanUsername = username.trim();
    if (this.db.users.some((u) => u.username.toLowerCase() === cleanUsername.toLowerCase())) {
      throw new Error('이미 사용 중인 아이디입니다.');
    }

    const space = this.db.spaces.find((s) => s.id === spaceId);
    if (!space) {
      throw new Error('선택한 학과(운영 공간)가 존재하지 않습니다.');
    }

    // 특정 인증 코드 검증 및 역할 확정 (조교 / 모더레이터 / 교수 / 일반재학생 / 열람전용)
    const assignedRole = this.resolveRoleByAuthCode(space.id, roleCode, initialRole);

    const roleTitleSuffix =
      assignedRole === 'SPACE_ADMIN'
        ? `(${space.name} 조교)`
        : assignedRole === 'NOTICE_MANAGER'
        ? `(${space.name} 교수)`
        : assignedRole === 'MODERATOR'
        ? `(${space.name} 모더레이터)`
        : '';

    const cleanName = name.trim();
    const displayName =
      roleTitleSuffix && !cleanName.includes('조교') && !cleanName.includes('교수') && !cleanName.includes('모더')
        ? `${cleanName} ${roleTitleSuffix}`
        : cleanName;

    const newUser = {
      id: 'user_' + Date.now(),
      username: cleanUsername,
      password,
      name: displayName,
      studentId: (studentId || '').trim() || '2026-' + Math.floor(1000 + Math.random() * 9000),
      email: (email || '').trim() || `${cleanUsername}@univ.ac.kr`,
      primaryDept: space.name,
      createdAt: new Date().toISOString()
    };

    this.db.users.push(newUser);

    // 핵심: 선택한 자기 학과(space.id)에만 해당 권한(조교/모더레이터/교수 등)을 부여! 타 학과 권한은 일절 부여하지 않음
    this.db.spaceMembers.push({
      id: 'sm_' + Date.now(),
      spaceId: space.id,
      userId: newUser.id,
      role: assignedRole,
      status: 'ACTIVE',
      joinedAt: new Date().toISOString()
    });

    if (assignedRole === 'SPACE_ADMIN') {
      space.assistantName = newUser.name;
    }

    window.StorageManager.setSessionUserId(newUser.id);
    await window.StorageManager.save();
    return { user: newUser, assignedRole, space };
  },

  // 로그인
  login(username, password) {
    const user = this.db.users.find(
      (u) => u.username.toLowerCase() === (username || '').trim().toLowerCase() && u.password === password
    );
    if (!user) {
      throw new Error('아이디 또는 비밀번호가 일치하지 않습니다.');
    }
    window.StorageManager.setSessionUserId(user.id);
    return user;
  },

  // 빠른 계정 전환 (테스트 및 시연용)
  switchUser(userId) {
    const user = this.db.users.find((u) => u.id === userId);
    if (!user) throw new Error('사용자를 찾을 수 없습니다.');
    window.StorageManager.setSessionUserId(user.id);
    return user;
  },

  logout() {
    window.StorageManager.setSessionUserId('');
  },

  // 사용자의 특정 공간 소속 정보 조회
  getSpaceMembership(spaceId, userId = null) {
    const uid = userId || (this.getCurrentUser() && this.getCurrentUser().id);
    if (!uid) return null;
    return (
      this.db.spaceMembers.find(
        (sm) => sm.spaceId === spaceId && sm.userId === uid && sm.status === 'ACTIVE'
      ) || null
    );
  },

  // 핵심 보안: 공간 간 접근 차단 검증
  checkSpaceAccess(spaceId, userId = null) {
    const space = this.db.spaces.find((s) => s.id === spaceId);
    if (!space) {
      return { allowed: false, reason: '존재하지 않는 운영 공간입니다.' };
    }
    const user = userId ? this.db.users.find((u) => u.id === userId) : this.getCurrentUser();
    if (!user) {
      return { allowed: false, reason: '로그인이 필요합니다.' };
    }
    const membership = this.getSpaceMembership(spaceId, user.id);
    if (!membership) {
      return {
        allowed: false,
        reason: `[공간 간 접근 차단] 현재 계정(${user.name})은 '${space.name}' 공간의 소속 구성원이 아니므로 게시판 열람·검색·첨부파일 다운로드가 차단되었습니다.`
      };
    }
    return {
      allowed: true,
      space,
      user,
      membership,
      roleMeta: this.getRoleMeta(membership.role)
    };
  },

  assertSpaceAccess(spaceId) {
    const check = this.checkSpaceAccess(spaceId);
    if (!check.allowed) {
      throw new Error(check.reason);
    }
    return check;
  },

  // 공간 내 세부 권한 계산
  getPermissions(spaceId, boardId = null) {
    const access = this.checkSpaceAccess(spaceId);
    if (!access.allowed) {
      return {
        allowed: false,
        role: null,
        canRead: false,
        canWritePost: false,
        canWriteComment: false,
        canRegisterNotice: false,
        canModerate: false,
        canManageSpace: false
      };
    }

    const role = access.membership.role;
    const isWriterUp = ['WRITER', 'NOTICE_MANAGER', 'MODERATOR', 'SPACE_ADMIN'].includes(role);
    const canRegisterNotice = ['NOTICE_MANAGER', 'SPACE_ADMIN'].includes(role);
    const canModerate = ['MODERATOR', 'SPACE_ADMIN'].includes(role);
    const canManageSpace = role === 'SPACE_ADMIN';

    let canWritePost = isWriterUp;
    if (boardId) {
      const board = this.db.boards.find((b) => b.id === boardId && b.spaceId === spaceId);
      if (board && board.writePermission === 'NOTICE_ONLY') {
        canWritePost = canRegisterNotice;
      }
    }

    return {
      allowed: true,
      role,
      roleMeta: access.roleMeta,
      canRead: true,
      canWritePost,
      canWriteComment: isWriterUp,
      canRegisterNotice,
      canModerate,
      canManageSpace
    };
  },

  // 새 운영 공간(학과) 생성
  async createSpace({ name, code, description, icon }) {
    const user = this.getCurrentUser();
    if (!user) throw new Error('로그인이 필요합니다.');
    if (!name || !name.trim()) throw new Error('공간(학과) 이름을 입력해 주세요.');

    const spaceId = 'space_' + Date.now();
    const cleanCode = (code || 'DEPT' + Math.floor(10 + Math.random() * 89)).trim().toUpperCase();
    const newSpace = {
      id: spaceId,
      name: name.trim(),
      code: cleanCode,
      description: (description || `${name.trim()} 구성원 전용 공지 및 의견 공유 공간입니다.`).trim(),
      icon: icon || '🏛️',
      assistantName: `${name.trim()} 전용 조교`,
      roleCodes: {
        SPACE_ADMIN: `${cleanCode}-ADMIN`,
        MODERATOR: `${cleanCode}-MOD`,
        NOTICE_MANAGER: `${cleanCode}-PROF`
      },
      createdAt: new Date().toISOString()
    };

    this.db.spaces.push(newSpace);

    // 과마다 전용 조교 계정 자동 생성 (해당 학과 권한만 보유)
    const autoTaUser = {
      id: `user_ta_${Date.now()}`,
      username: `admin_${cleanCode.toLowerCase()}`,
      password: 'password123',
      name: `${name.trim()} 조교 (${name.trim()} 전담)`,
      studentId: `STAFF-${cleanCode}`,
      email: `admin_${cleanCode.toLowerCase()}@univ.ac.kr`,
      primaryDept: newSpace.name,
      createdAt: new Date().toISOString()
    };
    this.db.users.push(autoTaUser);
    newSpace.assistantName = autoTaUser.name;

    this.db.spaceMembers.push({
      id: `sm_ta_${Date.now()}`,
      spaceId,
      userId: autoTaUser.id,
      role: 'SPACE_ADMIN',
      status: 'ACTIVE',
      joinedAt: new Date().toISOString()
    });

    // 기본 게시판 3종 자동 생성
    this.db.boards.push(
      {
        id: `board_${Date.now()}_1`,
        spaceId,
        name: `${newSpace.name} 공지사항`,
        description: '학과 공식 공지사항을 등록하고 확인하는 게시판입니다.',
        type: 'NOTICE',
        writePermission: 'NOTICE_ONLY',
        allowAnonymous: false,
        allowAttachments: true,
        categories: ['학사공지', '장학/취업', '학과행사'],
        sortOrder: 1
      },
      {
        id: `board_${Date.now()}_2`,
        spaceId,
        name: `${newSpace.name} 건의 및 의견 게시판`,
        description: '학과 운영 및 수업/시설 관련 의견을 제안하고 추천(공감)하는 게시판입니다.',
        type: 'OPINION',
        writePermission: 'WRITER_UP',
        allowAnonymous: true,
        allowAttachments: true,
        categories: ['시설건의', '수업/학사', '학생회건의'],
        sortOrder: 2
      },
      {
        id: `board_${Date.now()}_3`,
        spaceId,
        name: '자유 소통 · Q&A',
        description: '학과 구성원 간 질문과 자유로운 소통을 나누는 게시판입니다.',
        type: 'GENERAL',
        writePermission: 'WRITER_UP',
        allowAnonymous: true,
        allowAttachments: true,
        categories: ['질문/답변', '자유소통'],
        sortOrder: 3
      }
    );

    await window.StorageManager.save();
    return newSpace;
  },

  // 공간 내 게시판 목록 조회
  getBoardsBySpace(spaceId) {
    this.assertSpaceAccess(spaceId);
    return this.db.boards
      .filter((b) => b.spaceId === spaceId)
      .sort((a, b) => (a.sortOrder || 99) - (b.sortOrder || 99));
  },

  // 게시판 생성 (공간 관리자 전용)
  async createBoard(spaceId, { name, description, type, writePermission, allowAnonymous, allowAttachments, categories }) {
    const perms = this.getPermissions(spaceId);
    if (!perms.canManageSpace) {
      throw new Error('게시판 생성은 [게시판·운영공간을 관리하는 사람(공간 관리자)]만 가능합니다.');
    }
    if (!name || !name.trim()) {
      throw new Error('게시판 이름을 입력해 주세요.');
    }

    const catArray = Array.isArray(categories)
      ? categories
      : (categories || '일반,공지,질문')
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean);

    const existingBoards = this.db.boards.filter((b) => b.spaceId === spaceId);
    const newBoard = {
      id: 'board_' + Date.now(),
      spaceId,
      name: name.trim(),
      description: (description || '').trim(),
      type: type || 'GENERAL',
      writePermission: writePermission || (type === 'NOTICE' ? 'NOTICE_ONLY' : 'WRITER_UP'),
      allowAnonymous: Boolean(allowAnonymous),
      allowAttachments: allowAttachments !== undefined ? Boolean(allowAttachments) : true,
      categories: catArray.length > 0 ? catArray : ['일반'],
      sortOrder: existingBoards.length + 1
    };

    this.db.boards.push(newBoard);
    await window.StorageManager.save();
    return newBoard;
  },

  // 게시판 설정 수정 (공간 관리자 전용)
  async updateBoard(spaceId, boardId, payload) {
    const perms = this.getPermissions(spaceId);
    if (!perms.canManageSpace) {
      throw new Error('게시판 설정 수정 권한이 없습니다.');
    }
    const board = this.db.boards.find((b) => b.id === boardId && b.spaceId === spaceId);
    if (!board) throw new Error('게시판을 찾을 수 없습니다.');

    if (payload.name) board.name = payload.name.trim();
    if (payload.description !== undefined) board.description = payload.description.trim();
    if (payload.type) board.type = payload.type;
    if (payload.writePermission) board.writePermission = payload.writePermission;
    if (payload.allowAnonymous !== undefined) board.allowAnonymous = Boolean(payload.allowAnonymous);
    if (payload.allowAttachments !== undefined) board.allowAttachments = Boolean(payload.allowAttachments);
    if (payload.categories !== undefined) {
      const catArray = Array.isArray(payload.categories)
        ? payload.categories
        : String(payload.categories)
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean);
      board.categories = catArray.length > 0 ? catArray : ['일반'];
    }

    await window.StorageManager.save();
    return board;
  },

  // 게시판 삭제 (공간 관리자 전용)
  async deleteBoard(spaceId, boardId) {
    const perms = this.getPermissions(spaceId);
    if (!perms.canManageSpace) {
      throw new Error('게시판 삭제 권한이 없습니다.');
    }
    const boardsInSpace = this.db.boards.filter((b) => b.spaceId === spaceId);
    if (boardsInSpace.length <= 1) {
      throw new Error('공간에는 최소 1개 이상의 게시판이 있어야 합니다.');
    }
    this.db.boards = this.db.boards.filter((b) => !(b.id === boardId && b.spaceId === spaceId));
    this.db.posts = this.db.posts.filter((p) => p.boardId !== boardId);
    await window.StorageManager.save();
  },

  // 게시글 목록 조회 및 공간 내 검색
  getPosts({ spaceId, boardId = 'ALL', searchField = 'ALL', keyword = '', category = 'ALL', sortBy = 'LATEST' }) {
    // 1. 공간 간 접근 차단 강제 확인
    this.assertSpaceAccess(spaceId);

    // 2. 오직 해당 공간(spaceId)에 속한 게시글만 필터링 (타 공간 데이터 절대 포함 안 됨)
    let list = this.db.posts.filter((p) => p.spaceId === spaceId);

    // 특정 게시판 선택 시
    if (boardId && boardId !== 'ALL') {
      list = list.filter((p) => p.boardId === boardId);
    }

    // 카테고리 필터
    if (category && category !== 'ALL') {
      list = list.filter((p) => p.category === category);
    }

    // 검색어 필터
    const q = (keyword || '').trim().toLowerCase();
    if (q) {
      list = list.filter((p) => {
        const titleMatch = (p.title || '').toLowerCase().includes(q);
        const contentMatch = (p.content || '').toLowerCase().includes(q);
        const authorMatch = (p.authorName || '').toLowerCase().includes(q);
        const catMatch = (p.category || '').toLowerCase().includes(q);

        if (searchField === 'TITLE') return titleMatch;
        if (searchField === 'CONTENT') return contentMatch;
        if (searchField === 'AUTHOR') return authorMatch;
        return titleMatch || contentMatch || authorMatch || catMatch;
      });
    }

    // 정렬 (공지사항 상단 고정 우선 + 선택 정렬 기준)
    const notices = list
      .filter((p) => p.isNotice && !p.isBlinded)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const regulars = list.filter((p) => !p.isNotice || p.isBlinded);
    regulars.sort((a, b) => {
      if (sortBy === 'LIKES') {
        const diff = (b.likeUserIds?.length || 0) - (a.likeUserIds?.length || 0);
        if (diff !== 0) return diff;
      } else if (sortBy === 'VIEWS') {
        const diff = (b.viewCount || 0) - (a.viewCount || 0);
        if (diff !== 0) return diff;
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return { notices, regulars, totalCount: list.length };
  },

  // 게시글 상세 조회
  async getPostDetail(postId, incrementView = true) {
    const post = this.db.posts.find((p) => p.id === postId);
    if (!post) throw new Error('존재하지 않거나 삭제된 게시글입니다.');

    // 공간 간 접근 차단 검증
    this.assertSpaceAccess(post.spaceId);

    if (incrementView) {
      post.viewCount = (post.viewCount || 0) + 1;
      await window.StorageManager.save();
    }

    const board = this.db.boards.find((b) => b.id === post.boardId);
    const comments = this.db.comments
      .filter((c) => c.postId === post.id)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    return { post, board, comments };
  },

  // 게시글 작성 (제목, 내용, 작성자, 작성일시, 수정일시, 첨부파일 포함)
  async createPost({ spaceId, boardId, category, title, content, attachments = [], isNotice = false, isAnonymous = false }) {
    const access = this.assertSpaceAccess(spaceId);
    const perms = this.getPermissions(spaceId, boardId);

    if (!perms.canWritePost) {
      if (perms.role === 'READER') {
        throw new Error('현재 역할(게시글을 읽는 사람)은 열람 전용이므로 게시글을 작성할 수 없습니다.');
      }
      throw new Error('이 게시판에 게시글을 작성할 권한이 없습니다 (공지 전용 게시판은 공지 등록자만 작성 가능).');
    }

    if (!title || !title.trim()) throw new Error('제목을 입력해 주세요.');
    if (!content || !content.trim()) throw new Error('내용을 입력해 주세요.');

    const board = this.db.boards.find((b) => b.id === boardId && b.spaceId === spaceId);
    if (!board) throw new Error('대상 게시판을 찾을 수 없습니다.');

    const finalNotice = Boolean(isNotice && perms.canRegisterNotice);
    const finalAnon = Boolean(isAnonymous && board.allowAnonymous && !finalNotice);
    const nowIso = new Date().toISOString();

    const newPost = {
      id: 'post_' + Date.now(),
      spaceId,
      boardId,
      category: category || (board.categories && board.categories[0]) || '일반',
      title: title.trim(),
      content: content.trim(),
      authorId: access.user.id,
      authorName: finalAnon ? '익명 학우' : access.user.name,
      isAnonymous: finalAnon,
      isNotice: finalNotice,
      createdAt: nowIso,
      updatedAt: nowIso,
      attachments: Array.isArray(attachments) ? attachments : [],
      viewCount: 0,
      likeUserIds: [],
      isBlinded: false,
      blindReason: ''
    };

    this.db.posts.unshift(newPost);

    // 공지사항으로 등록된 경우 같은 학과 공간 구성원들에게 새 공지 알림 발송
    if (finalNotice) {
      const members = this.db.spaceMembers.filter(
        (sm) => sm.spaceId === spaceId && sm.status === 'ACTIVE' && sm.userId !== access.user.id
      );
      members.forEach((sm, idx) => {
        this.db.notifications.unshift({
          id: `noti_${Date.now()}_${idx}`,
          userId: sm.userId,
          spaceId,
          type: 'NOTICE',
          message: `[새 공지] ${access.space.name}에 "${newPost.title}" 공지가 등록되었습니다.`,
          postId: newPost.id,
          isRead: false,
          createdAt: nowIso
        });
      });
    }

    await window.StorageManager.save();
    return newPost;
  },

  // 게시글 수정 (본인 또는 공간 관리자, 수정일시 자동 갱신)
  async updatePost(postId, { category, title, content, attachments, isNotice, isAnonymous }) {
    const post = this.db.posts.find((p) => p.id === postId);
    if (!post) throw new Error('게시글을 찾을 수 없습니다.');

    const access = this.assertSpaceAccess(post.spaceId);
    const perms = this.getPermissions(post.spaceId, post.boardId);

    const isOwner = post.authorId === access.user.id;
    if (!isOwner && !perms.canManageSpace) {
      throw new Error('본인이 작성한 게시글만 수정할 수 있습니다.');
    }

    if (!title || !title.trim()) throw new Error('제목을 입력해 주세요.');
    if (!content || !content.trim()) throw new Error('내용을 입력해 주세요.');

    const board = this.db.boards.find((b) => b.id === post.boardId);

    post.title = title.trim();
    post.content = content.trim();
    if (category) post.category = category;
    if (Array.isArray(attachments)) post.attachments = attachments;

    if (perms.canRegisterNotice && isNotice !== undefined) {
      post.isNotice = Boolean(isNotice);
    }

    if (board && board.allowAnonymous && isAnonymous !== undefined && !post.isNotice) {
      post.isAnonymous = Boolean(isAnonymous);
      const authorUser = this.db.users.find((u) => u.id === post.authorId);
      post.authorName = post.isAnonymous ? '익명 학우' : (authorUser ? authorUser.name : post.authorName);
    }

    // 수정일시 자동 업데이트
    post.updatedAt = new Date().toISOString();

    await window.StorageManager.save();
    return post;
  },

  // 게시글 삭제 (본인 또는 부적절 게시물 관리자/공간 관리자)
  async deletePost(postId) {
    const post = this.db.posts.find((p) => p.id === postId);
    if (!post) throw new Error('게시글을 찾을 수 없습니다.');

    const access = this.assertSpaceAccess(post.spaceId);
    const perms = this.getPermissions(post.spaceId, post.boardId);
    const isOwner = post.authorId === access.user.id;

    if (!isOwner && !perms.canModerate) {
      throw new Error('게시글 삭제 권한이 없습니다.');
    }

    // 관리자가 타인의 글을 강제 삭제한 경우 작성자에게 알림 전송
    if (!isOwner && perms.canModerate) {
      this.db.notifications.unshift({
        id: 'noti_' + Date.now(),
        userId: post.authorId,
        spaceId: post.spaceId,
        type: 'MODERATION',
        message: `[관리 조치] 작성하신 게시글 "${post.title}"이(가) 운영규칙 위반으로 관리자에 의해 삭제되었습니다.`,
        postId: null,
        isRead: false,
        createdAt: new Date().toISOString()
      });
    }

    this.db.posts = this.db.posts.filter((p) => p.id !== postId);
    this.db.comments = this.db.comments.filter((c) => c.postId !== postId);
    await window.StorageManager.save();
  },

  // 게시글 추천 (공감) 토글
  async togglePostLike(postId) {
    const post = this.db.posts.find((p) => p.id === postId);
    if (!post) throw new Error('게시글을 찾을 수 없습니다.');

    const access = this.assertSpaceAccess(post.spaceId);
    if (!post.likeUserIds) post.likeUserIds = [];

    const idx = post.likeUserIds.indexOf(access.user.id);
    let liked = false;
    if (idx >= 0) {
      post.likeUserIds.splice(idx, 1);
      liked = false;
    } else {
      post.likeUserIds.push(access.user.id);
      liked = true;

      // 본인 글이 아니면 작성자에게 추천 알림 발송
      if (post.authorId !== access.user.id) {
        this.db.notifications.unshift({
          id: 'noti_' + Date.now(),
          userId: post.authorId,
          spaceId: post.spaceId,
          type: 'LIKE',
          message: `[추천 알림] ${access.user.name}님이 회원님의 게시글 "${post.title}"을(를) 추천했습니다.`,
          postId: post.id,
          isRead: false,
          createdAt: new Date().toISOString()
        });
      }
    }

    await window.StorageManager.save();
    return { liked, likeCount: post.likeUserIds.length };
  },

  // 댓글 작성
  async createComment(postId, content) {
    const post = this.db.posts.find((p) => p.id === postId);
    if (!post) throw new Error('게시글을 찾을 수 없습니다.');

    const access = this.assertSpaceAccess(post.spaceId);
    const perms = this.getPermissions(post.spaceId, post.boardId);

    if (!perms.canWriteComment) {
      throw new Error('현재 역할(게시글을 읽는 사람)은 댓글을 작성할 수 없습니다.');
    }
    if (!content || !content.trim()) {
      throw new Error('댓글 내용을 입력해 주세요.');
    }

    const nowIso = new Date().toISOString();
    const newComment = {
      id: 'cmt_' + Date.now(),
      postId: post.id,
      spaceId: post.spaceId,
      authorId: access.user.id,
      authorName: access.user.name,
      content: content.trim(),
      createdAt: nowIso,
      updatedAt: nowIso,
      isBlinded: false
    };

    this.db.comments.push(newComment);

    // 게시글 작성자에게 댓글 알림 발송
    if (post.authorId !== access.user.id) {
      this.db.notifications.unshift({
        id: 'noti_' + Date.now(),
        userId: post.authorId,
        spaceId: post.spaceId,
        type: 'COMMENT',
        message: `[댓글 알림] "${post.title}" 게시글에 ${access.user.name}님이 댓글을 남겼습니다.`,
        postId: post.id,
        isRead: false,
        createdAt: nowIso
      });
    }

    await window.StorageManager.save();
    return newComment;
  },

  // 댓글 수정 (본인 전용)
  async updateComment(commentId, content) {
    const cmt = this.db.comments.find((c) => c.id === commentId);
    if (!cmt) throw new Error('댓글을 찾을 수 없습니다.');

    const access = this.assertSpaceAccess(cmt.spaceId);
    if (cmt.authorId !== access.user.id) {
      throw new Error('본인이 작성한 댓글만 수정할 수 있습니다.');
    }
    if (!content || !content.trim()) {
      throw new Error('댓글 내용을 입력해 주세요.');
    }

    cmt.content = content.trim();
    cmt.updatedAt = new Date().toISOString();
    await window.StorageManager.save();
    return cmt;
  },

  // 댓글 삭제 (본인 또는 부적절 게시물 관리자/공간 관리자)
  async deleteComment(commentId) {
    const cmt = this.db.comments.find((c) => c.id === commentId);
    if (!cmt) throw new Error('댓글을 찾을 수 없습니다.');

    const access = this.assertSpaceAccess(cmt.spaceId);
    const perms = this.getPermissions(cmt.spaceId);

    if (cmt.authorId !== access.user.id && !perms.canModerate) {
      throw new Error('댓글 삭제 권한이 없습니다.');
    }

    this.db.comments = this.db.comments.filter((c) => c.id !== commentId);
    await window.StorageManager.save();
  },

  // 내 게시글과 댓글 모아보기 (일반 사용자 요구사항: 자신의 게시글과 댓글을 쉽게 관리)
  getMyActivity(spaceId) {
    const access = this.assertSpaceAccess(spaceId);
    const myPosts = this.db.posts
      .filter((p) => p.spaceId === spaceId && p.authorId === access.user.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const myComments = this.db.comments
      .filter((c) => c.spaceId === spaceId && c.authorId === access.user.id)
      .map((c) => {
        const parentPost = this.db.posts.find((p) => p.id === c.postId);
        return {
          ...c,
          postTitle: parentPost ? parentPost.title : '(삭제된 게시글)'
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return { myPosts, myComments };
  },

  // 관리자 기능 1: 게시글을 목적에 맞는 다른 게시판으로 이동
  async movePost(postId, targetBoardId) {
    const post = this.db.posts.find((p) => p.id === postId);
    if (!post) throw new Error('게시글을 찾을 수 없습니다.');

    const perms = this.getPermissions(post.spaceId);
    if (!perms.canModerate) {
      throw new Error('게시글 이동은 게시물 관리자 또는 공간 관리자만 가능합니다.');
    }

    const targetBoard = this.db.boards.find((b) => b.id === targetBoardId && b.spaceId === post.spaceId);
    if (!targetBoard) throw new Error('이동할 대상 게시판을 찾을 수 없습니다.');

    post.boardId = targetBoard.id;
    post.category = (targetBoard.categories && targetBoard.categories[0]) || '일반';
    post.updatedAt = new Date().toISOString();

    this.db.notifications.unshift({
      id: 'noti_' + Date.now(),
      userId: post.authorId,
      spaceId: post.spaceId,
      type: 'MODERATION',
      message: `[게시판 이동 안내] 작성하신 "${post.title}" 게시글이 게시판 목적에 맞게 [${targetBoard.name}] 게시판으로 이동되었습니다.`,
      postId: post.id,
      isRead: false,
      createdAt: new Date().toISOString()
    });

    await window.StorageManager.save();
    return post;
  },

  // 관리자 기능 2: 부적절한 게시글 블라인드(숨김) 처리 및 해제
  async toggleBlindPost(postId, reason = '부적절한 게시물로 판단되어 관리자에 의해 숨김(블라인드) 처리되었습니다.') {
    const post = this.db.posts.find((p) => p.id === postId);
    if (!post) throw new Error('게시글을 찾을 수 없습니다.');

    const perms = this.getPermissions(post.spaceId);
    if (!perms.canModerate) {
      throw new Error('부적절한 게시물 블라인드 처리는 [부적절한 게시물을 관리하는 사람] 또는 [공간 관리자]만 가능합니다.');
    }

    post.isBlinded = !post.isBlinded;
    post.blindReason = post.isBlinded ? reason : '';

    this.db.notifications.unshift({
      id: 'noti_' + Date.now(),
      userId: post.authorId,
      spaceId: post.spaceId,
      type: 'MODERATION',
      message: post.isBlinded
        ? `[관리 조치] 회원님의 게시글 "${post.title}"이(가) 블라인드(숨김) 처리되었습니다. 사유: ${post.blindReason}`
        : `[관리 조치] 회원님의 게시글 "${post.title}"의 블라인드 처리가 해제되었습니다.`,
      postId: post.id,
      isRead: false,
      createdAt: new Date().toISOString()
    });

    await window.StorageManager.save();
    return post;
  },

  // 관리자 기능 3: 부적절한 댓글 블라인드(숨김) 처리 및 해제
  async toggleBlindComment(commentId) {
    const cmt = this.db.comments.find((c) => c.id === commentId);
    if (!cmt) throw new Error('댓글을 찾을 수 없습니다.');

    const perms = this.getPermissions(cmt.spaceId);
    if (!perms.canModerate) {
      throw new Error('부적절한 댓글 관리는 모더레이터 또는 공간 관리자만 가능합니다.');
    }

    cmt.isBlinded = !cmt.isBlinded;
    await window.StorageManager.save();
    return cmt;
  },

  // 부적절한 게시물/댓글 신고 접수
  async reportContent({ spaceId, targetType, targetId, reason }) {
    const access = this.assertSpaceAccess(spaceId);
    if (!reason || !reason.trim()) {
      throw new Error('신고 사유를 입력해 주세요.');
    }

    const newReport = {
      id: 'rep_' + Date.now(),
      spaceId,
      targetType, // POST | COMMENT
      targetId,
      reporterId: access.user.id,
      reporterName: access.user.name,
      reason: reason.trim(),
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      resolvedBy: '',
      resolvedNote: ''
    };

    this.db.reports.unshift(newReport);

    // 해당 공간의 모더레이터 및 공간 관리자에게 신고 알림 발송
    const managers = this.db.spaceMembers.filter(
      (sm) => sm.spaceId === spaceId && ['MODERATOR', 'SPACE_ADMIN'].includes(sm.role)
    );
    managers.forEach((mgr, i) => {
      this.db.notifications.unshift({
        id: `noti_${Date.now()}_m${i}`,
        userId: mgr.userId,
        spaceId,
        type: 'MODERATION',
        message: `[신고 접수] ${access.user.name}님이 부적절한 게시물을 신고했습니다. 사유: "${reason.trim()}"`,
        postId: targetType === 'POST' ? targetId : null,
        isRead: false,
        createdAt: new Date().toISOString()
      });
    });

    await window.StorageManager.save();
    return newReport;
  },

  // 신고 내역 처리 완료 표시
  async resolveReport(reportId, note = '조치 완료') {
    const rep = this.db.reports.find((r) => r.id === reportId);
    if (!rep) throw new Error('신고 내역을 찾을 수 없습니다.');

    const access = this.assertSpaceAccess(rep.spaceId);
    const perms = this.getPermissions(rep.spaceId);
    if (!perms.canModerate) throw new Error('신고 처리 권한이 없습니다.');

    rep.status = 'RESOLVED';
    rep.resolvedBy = access.user.name;
    rep.resolvedNote = note;
    await window.StorageManager.save();
    return rep;
  },

  // 공간 구성원 역할 변경 / 문제 사용자 작성 제한 / 신규 구성원 초대
  async setMemberRole(spaceId, targetUserId, newRole) {
    const access = this.assertSpaceAccess(spaceId);
    const perms = this.getPermissions(spaceId);

    // 모더레이터는 문제 사용자를 READER(읽기 전용)로 강등(글쓰기 제한)하는 것만 가능, 전체 역할 관리는 SPACE_ADMIN만 가능
    if (!perms.canManageSpace && !(perms.canModerate && newRole === 'READER')) {
      throw new Error('구성원 역할 변경 권한이 없습니다.');
    }

    if (!ROLE_META[newRole]) throw new Error('올바르지 않은 역할 코드입니다.');

    let member = this.db.spaceMembers.find((sm) => sm.spaceId === spaceId && sm.userId === targetUserId);
    if (member) {
      member.role = newRole;
      member.status = 'ACTIVE';
    } else {
      member = {
        id: 'sm_' + Date.now(),
        spaceId,
        userId: targetUserId,
        role: newRole,
        status: 'ACTIVE',
        joinedAt: new Date().toISOString()
      };
      this.db.spaceMembers.push(member);
    }

    this.db.notifications.unshift({
      id: 'noti_' + Date.now(),
      userId: targetUserId,
      spaceId,
      type: 'MODERATION',
      message: `[역할 변경] ${access.space.name} 공간에서의 역할이 [${ROLE_META[newRole].label}](으)로 설정되었습니다.`,
      postId: null,
      isRead: false,
      createdAt: new Date().toISOString()
    });

    await window.StorageManager.save();
    return member;
  },

  // 공간에서 구성원 퇴출 (공간 간 접근 차단 즉시 적용됨)
  async removeMemberFromSpace(spaceId, targetUserId) {
    const access = this.assertSpaceAccess(spaceId);
    const perms = this.getPermissions(spaceId);
    if (!perms.canManageSpace) {
      throw new Error('공간 구성원 퇴출은 공간 관리자만 가능합니다.');
    }
    if (access.user.id === targetUserId) {
      throw new Error('공간 관리자 본인을 퇴출할 수 없습니다.');
    }

    this.db.spaceMembers = this.db.spaceMembers.filter(
      (sm) => !(sm.spaceId === spaceId && sm.userId === targetUserId)
    );
    await window.StorageManager.save();
  },

  // 알림 조회 및 읽음 처리
  getUserNotifications() {
    const user = this.getCurrentUser();
    if (!user) return [];
    return this.db.notifications
      .filter((n) => n.userId === user.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async markNotificationRead(notiId) {
    const noti = this.db.notifications.find((n) => n.id === notiId);
    if (noti) {
      noti.isRead = true;
      await window.StorageManager.save();
    }
  },

  async markAllNotificationsRead() {
    const user = this.getCurrentUser();
    if (!user) return;
    this.db.notifications.forEach((n) => {
      if (n.userId === user.id) n.isRead = true;
    });
    await window.StorageManager.save();
  }
};

window.BoardService = BoardService;
