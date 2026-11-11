/**
 * storage.js
 * 데이터 영속성(Persistence) 엔진 및 초기 시드 데이터 관리
 * - 브라우저를 껐다 켜도 데이터가 유지되도록 LocalStorage + IndexedDB + 로컬 서버(data/db.json) 삼중 영구 저장 지원
 */

const STORAGE_KEY = 'DEPT_MULTIBOARD_DB_V3';
const SESSION_KEY = 'DEPT_MULTIBOARD_SESSION_V3';
const IDB_NAME = 'DeptMultiBoardIndexedDB';
const IDB_STORE = 'app_state';

// 텍스트 파일 DataURL 생성 헬퍼 (샘플 첨부파일 다운로드용)
function createSampleFileDataUrl(content, mimeType = 'text/plain;charset=utf-8') {
  const base64 = btoa(unescape(encodeURIComponent(content)));
  return `data:${mimeType};base64,${base64}`;
}

// 초기 기본 시드 데이터 생성
function createInitialDatabase() {
  const sampleAttachment1 = {
    id: 'att_101',
    fileName: '2026학년도_2학기_졸업작품_심사계획서_및_제출양식.txt',
    fileSize: 1420,
    mimeType: 'text/plain',
    uploadedAt: '2026-11-09T10:00:00+09:00',
    dataUrl: createSampleFileDataUrl(
      `[컴퓨터공학과 공지 첨부파일]\n` +
      `제목: 2026학년도 2학기 졸업작품 최종 심사 계획 및 보고서 양식\n\n` +
      `1. 제출 기한: 2026년 11월 25일(수) 18:00까지\n` +
      `2. 제출 서류: 졸업작품 요약서 1부, 최종 결과보고서 1부, 시연 영상 또는 실행 파일\n` +
      `3. 심사 일시: 2026년 12월 2일(수) 14:00 ~ 17:00 (공학관 302호)\n` +
      `4. 문의처: 컴퓨터공학과 학과사무실 (02-123-4567)\n`
    )
  };

  const sampleAttachment2 = {
    id: 'att_102',
    fileName: '학회장학금_및_성적우수장학금_신청안내문.txt',
    fileSize: 980,
    mimeType: 'text/plain',
    uploadedAt: '2026-11-10T14:20:00+09:00',
    dataUrl: createSampleFileDataUrl(
      `[컴퓨터공학과 장학 공지]\n` +
      `2026-2학기 학과 성적우수 및 봉사장학금 신청 안내\n\n` +
      `- 신청 대상: 컴퓨터공학과 재학생 (직전 학기 15학점 이상 이수, 평점 3.5 이상)\n` +
      `- 제출 방법: 학과 게시판 첨부 신청서 작성 후 학과사무실 방문 또는 온라인 제출\n`
    )
  };

  const sampleAttachment3 = {
    id: 'att_103',
    fileName: '실습실_서버_GPU_이용신청서_양식.txt',
    fileSize: 760,
    mimeType: 'text/plain',
    uploadedAt: '2026-11-08T11:00:00+09:00',
    dataUrl: createSampleFileDataUrl(
      `[컴퓨터공학과 실습실 GPU 워크스테이션 사용 신청서]\n` +
      `- 신청자 학번/성명:\n` +
      `- 사용 목적 (수업/졸업작품/연구):\n` +
      `- 희망 사용 기간:\n`
    )
  };

  return {
    meta: {
      version: '1.0.0',
      lastSavedAt: new Date().toISOString()
    },

    // 1. 전체 사용자 계정 (회원가입/로그인 대상 — 과마다 전용 조교 배치)
    users: [
      {
        id: 'user_admin',
        username: 'admin_cse',
        password: 'password123',
        name: '박조교 (컴퓨터공학과 조교)',
        studentId: 'STAFF-CSE-01',
        email: 'admin_cse@univ.ac.kr',
        primaryDept: '컴퓨터공학과',
        createdAt: '2026-03-02T09:00:00+09:00'
      },
      {
        id: 'user_notice',
        username: 'prof_cse',
        password: 'password123',
        name: '김교수 (컴퓨터공학과 교수)',
        studentId: 'PROF-101',
        email: 'prof_cse@univ.ac.kr',
        primaryDept: '컴퓨터공학과',
        createdAt: '2026-03-02T09:05:00+09:00'
      },
      {
        id: 'user_mod',
        username: 'mod_cse',
        password: 'password123',
        name: '이모더 (컴공 모더레이터/학생회)',
        studentId: '20230011',
        email: 'mod_cse@univ.ac.kr',
        primaryDept: '컴퓨터공학과',
        createdAt: '2026-03-02T09:10:00+09:00'
      },
      {
        id: 'user_writer',
        username: 'writer01',
        password: 'password123',
        name: '정학우 (컴퓨터공학과 재학생)',
        studentId: '20260019',
        email: 'writer01@univ.ac.kr',
        primaryDept: '컴퓨터공학과',
        createdAt: '2026-03-02T09:15:00+09:00'
      },
      {
        id: 'user_reader',
        username: 'reader01',
        password: 'password123',
        name: '최신입 (열람전용/신입생)',
        studentId: '20260099',
        email: 'reader01@univ.ac.kr',
        primaryDept: '컴퓨터공학과',
        createdAt: '2026-03-02T09:20:00+09:00'
      },
      {
        id: 'user_design_admin',
        username: 'admin_dsn',
        password: 'password123',
        name: '한조교 (디자인학과 조교)',
        studentId: 'STAFF-DSN-01',
        email: 'admin_dsn@univ.ac.kr',
        primaryDept: '디자인학과',
        createdAt: '2026-03-02T09:25:00+09:00'
      },
      {
        id: 'user_design',
        username: 'design01',
        password: 'password123',
        name: '강예린 (디자인학과 재학생)',
        studentId: '20250401',
        email: 'design01@univ.ac.kr',
        primaryDept: '디자인학과',
        createdAt: '2026-03-02T09:30:00+09:00'
      },
      {
        id: 'user_biz',
        username: 'admin_biz',
        password: 'password123',
        name: '오조교 (경영학과 조교)',
        studentId: 'STAFF-BIZ-01',
        email: 'admin_biz@univ.ac.kr',
        primaryDept: '경영학과',
        createdAt: '2026-03-02T09:35:00+09:00'
      }
    ],

    // 2. 운영 공간 (학과별 독립 공간 + 학과별 조교/모더레이터/교수 가입 인증 코드)
    spaces: [
      {
        id: 'space_cse',
        name: '컴퓨터공학과',
        code: 'CSE',
        description: '컴퓨터공학과 구성원(교수·조교·재학생) 전용 공지 및 학과 의견 공유 공간입니다.',
        icon: '💻',
        assistantName: '박조교 (컴퓨터공학과 조교)',
        roleCodes: {
          SPACE_ADMIN: 'CSE-ADMIN',
          MODERATOR: 'CSE-MOD',
          NOTICE_MANAGER: 'CSE-PROF'
        },
        createdAt: '2026-03-01T09:00:00+09:00'
      },
      {
        id: 'space_design',
        name: '디자인학과',
        code: 'DSN',
        description: '디자인학과 구성원 전용 과제전 공지, 실기실 운영 의견 및 포트폴리오 공유 공간입니다.',
        icon: '🎨',
        assistantName: '한조교 (디자인학과 조교)',
        roleCodes: {
          SPACE_ADMIN: 'DSN-ADMIN',
          MODERATOR: 'DSN-MOD',
          NOTICE_MANAGER: 'DSN-PROF'
        },
        createdAt: '2026-03-01T09:10:00+09:00'
      },
      {
        id: 'space_biz',
        name: '경영학과',
        code: 'BIZ',
        description: '경영학과 구성원 전용 학사 공지, 학회 모집 및 학과 건의사항 공유 공간입니다.',
        icon: '📊',
        assistantName: '오조교 (경영학과 조교)',
        roleCodes: {
          SPACE_ADMIN: 'BIZ-ADMIN',
          MODERATOR: 'BIZ-MOD',
          NOTICE_MANAGER: 'BIZ-PROF'
        },
        createdAt: '2026-03-01T09:20:00+09:00'
      }
    ],

    // 3. 공간별 소속 구성원 및 5대 역할 매핑 (과마다 조교가 자기 학과 권한만 보유, 타 학과 권한 없음)
    // 역할(role): READER | WRITER | NOTICE_MANAGER | MODERATOR | SPACE_ADMIN
    spaceMembers: [
      // 컴퓨터공학과 구성원 (박조교는 오직 컴퓨터공학과에서만 SPACE_ADMIN 권한 보유)
      { id: 'sm_1', spaceId: 'space_cse', userId: 'user_admin', role: 'SPACE_ADMIN', status: 'ACTIVE', joinedAt: '2026-03-02T09:00:00+09:00' },
      { id: 'sm_2', spaceId: 'space_cse', userId: 'user_notice', role: 'NOTICE_MANAGER', status: 'ACTIVE', joinedAt: '2026-03-02T09:05:00+09:00' },
      { id: 'sm_3', spaceId: 'space_cse', userId: 'user_mod', role: 'MODERATOR', status: 'ACTIVE', joinedAt: '2026-03-02T09:10:00+09:00' },
      { id: 'sm_4', spaceId: 'space_cse', userId: 'user_writer', role: 'WRITER', status: 'ACTIVE', joinedAt: '2026-03-02T09:15:00+09:00' },
      { id: 'sm_5', spaceId: 'space_cse', userId: 'user_reader', role: 'READER', status: 'ACTIVE', joinedAt: '2026-03-02T09:20:00+09:00' },

      // 디자인학과 구성원 (한조교는 오직 디자인학과에서만 SPACE_ADMIN 권한 보유)
      { id: 'sm_6', spaceId: 'space_design', userId: 'user_design_admin', role: 'SPACE_ADMIN', status: 'ACTIVE', joinedAt: '2026-03-02T09:25:00+09:00' },
      { id: 'sm_7', spaceId: 'space_design', userId: 'user_design', role: 'WRITER', status: 'ACTIVE', joinedAt: '2026-03-02T09:30:00+09:00' },

      // 경영학과 구성원 (오조교는 오직 경영학과에서만 SPACE_ADMIN 권한 보유)
      { id: 'sm_8', spaceId: 'space_biz', userId: 'user_biz', role: 'SPACE_ADMIN', status: 'ACTIVE', joinedAt: '2026-03-02T09:35:00+09:00' }
    ],

    // 4. 공간별 여러 게시판 (다중게시판)
    boards: [
      // 컴퓨터공학과 게시판 4종
      {
        id: 'board_cse_notice',
        spaceId: 'space_cse',
        name: '학과 공지사항',
        description: '학사 일정, 장학금, 졸업요건, 학과 행사 등 공식 공지사항을 등록하는 게시판입니다.',
        type: 'NOTICE', // NOTICE(공지전용) | OPINION(건의/의견) | GENERAL(자유/소통) | ARCHIVE(자료실)
        writePermission: 'NOTICE_ONLY', // NOTICE_ONLY(공지등록자/관리자만 작성) | WRITER_UP(작성권한자 이상 모두)
        allowAnonymous: false,
        allowAttachments: true,
        categories: ['학사공지', '장학/취업', '졸업/심사', '학과행사'],
        sortOrder: 1
      },
      {
        id: 'board_cse_opinion',
        spaceId: 'space_cse',
        name: '학과 건의 및 의견 나눔',
        description: '실습실 환경, 전공 수업 개설, 학과 행사 등 학과 운영에 대한 구성원의 의견을 자유롭게 제안하고 추천(공감)하는 공간입니다.',
        type: 'OPINION',
        writePermission: 'WRITER_UP',
        allowAnonymous: true,
        allowAttachments: true,
        categories: ['시설/실습실', '교육과정/수업', '학생회/행사', '기타건의'],
        sortOrder: 2
      },
      {
        id: 'board_cse_free',
        spaceId: 'space_cse',
        name: '자유 소통 · Q&A',
        description: '전공 공부 질문, 프로젝트 팀원 모집, 스터디, 선후배 간 자유로운 이야기를 나누는 게시판입니다.',
        type: 'GENERAL',
        writePermission: 'WRITER_UP',
        allowAnonymous: true,
        allowAttachments: true,
        categories: ['질문/답변', '스터디/팀원모집', '자유이야기', '취업/진로'],
        sortOrder: 3
      },
      {
        id: 'board_cse_archive',
        spaceId: 'space_cse',
        name: '학과 양식 · 자료실',
        description: '학과 내규, 실습실 이용 신청서, 졸업논문 템플릿 등 각종 서식과 자료를 공유합니다.',
        type: 'ARCHIVE',
        writePermission: 'WRITER_UP',
        allowAnonymous: false,
        allowAttachments: true,
        categories: ['행정양식', '수업/특강자료', '기타자료'],
        sortOrder: 4
      },

      // 디자인학과 게시판 3종
      {
        id: 'board_dsn_notice',
        spaceId: 'space_design',
        name: '디자인학과 공식 공지',
        description: '졸업전시회, 실기실 배정, 학사 일정 공지 게시판입니다.',
        type: 'NOTICE',
        writePermission: 'NOTICE_ONLY',
        allowAnonymous: false,
        allowAttachments: true,
        categories: ['졸업전시', '실기실공지', '학사안내'],
        sortOrder: 1
      },
      {
        id: 'board_dsn_opinion',
        spaceId: 'space_design',
        name: '디자인학과 건의/의견 게시판',
        description: '실기실 기자재, 야간 개방, 전시 지원 등에 대한 학과 구성원 의견 수렴 공간입니다.',
        type: 'OPINION',
        writePermission: 'WRITER_UP',
        allowAnonymous: true,
        allowAttachments: true,
        categories: ['실기실/기자재', '전시/행사', '수업건의'],
        sortOrder: 2
      },
      {
        id: 'board_dsn_free',
        spaceId: 'space_design',
        name: '작품 피드백 · 자유게시판',
        description: '포트폴리오 피드백 및 자유 소통 게시판입니다.',
        type: 'GENERAL',
        writePermission: 'WRITER_UP',
        allowAnonymous: false,
        allowAttachments: true,
        categories: ['작품피드백', '자유소통'],
        sortOrder: 3
      },

      // 경영학과 게시판 2종
      {
        id: 'board_biz_notice',
        spaceId: 'space_biz',
        name: '경영학과 공지사항',
        description: '경영학과 학사 및 CPA/고시반 지원 공지 게시판입니다.',
        type: 'NOTICE',
        writePermission: 'NOTICE_ONLY',
        allowAnonymous: false,
        allowAttachments: true,
        categories: ['학사공지', '장학/취업'],
        sortOrder: 1
      },
      {
        id: 'board_biz_opinion',
        spaceId: 'space_biz',
        name: '경영학과 학생 의견 게시판',
        description: '경영학과 학우들의 건의사항과 의견을 나누는 게시판입니다.',
        type: 'OPINION',
        writePermission: 'WRITER_UP',
        allowAnonymous: true,
        allowAttachments: true,
        categories: ['건의사항', '학회/동아리'],
        sortOrder: 2
      }
    ],

    // 5. 게시글 (제목, 내용, 작성자, 작성일시, 수정일시, 첨부파일 포함)
    posts: [
      {
        id: 'post_101',
        spaceId: 'space_cse',
        boardId: 'board_cse_notice',
        category: '졸업/심사',
        title: '[필독] 2026학년도 2학기 졸업작품 최종 심사 일정 및 보고서 양식 안내',
        content: `안녕하세요, 컴퓨터공학과 학과장 김교수입니다.\n\n2026학년도 2학기 졸업작품(캡스톤디자인) 최종 발표 및 심사 일정을 안내합니다.\n발표 대상 팀은 첨부된 '졸업작품 심사계획서 및 제출양식' 파일을 다운로드하여 기한 내에 제출해 주시기 바랍니다.\n\n■ 제출 마감: 2026년 11월 25일(수) 18:00까지\n■ 본 심사일: 2026년 12월 2일(수) 14:00 ~ 17:00 (공학관 302호)\n■ 필수 제출물: 최종 보고서, 발표자료(PPT), 시연 영상\n\n궁금한 사항은 댓글로 남겨주시거나 학과사무실로 문의 바랍니다.`,
        authorId: 'user_notice',
        authorName: '김교수 (학과장/공지담당)',
        isAnonymous: false,
        isNotice: true,
        createdAt: '2026-11-09T10:00:00+09:00',
        updatedAt: '2026-11-09T14:30:00+09:00',
        attachments: [sampleAttachment1],
        viewCount: 128,
        likeUserIds: ['user_admin', 'user_mod', 'user_writer'],
        isBlinded: false,
        blindReason: ''
      },
      {
        id: 'post_102',
        spaceId: 'space_cse',
        boardId: 'board_cse_notice',
        category: '장학/취업',
        title: '2026-2학기 컴퓨터공학과 성적우수 및 학과봉사 장학금 신청 안내',
        content: `컴퓨터공학과 학과사무실 박조교입니다.\n\n이번 학기 학과 자체 장학금(성적우수 및 학과봉사 장학금) 신청을 받습니다.\n첨부된 안내문을 꼭 확인하시고 기간 내 신청해 주세요.\n\n1. 신청 기간: 2026.11.11(수) ~ 2026.11.18(수)\n2. 대상: 직전 학기 15학점 이상 이수 재학생\n3. 제출 서류: 장학금 신청서 1부 (첨부파일 참조)`,
        authorId: 'user_admin',
        authorName: '박조교 (학과조교)',
        isAnonymous: false,
        isNotice: true,
        createdAt: '2026-11-10T14:20:00+09:00',
        updatedAt: '2026-11-10T14:20:00+09:00',
        attachments: [sampleAttachment2],
        viewCount: 95,
        likeUserIds: ['user_writer', 'user_mod'],
        isBlinded: false,
        blindReason: ''
      },
      {
        id: 'post_103',
        spaceId: 'space_cse',
        boardId: 'board_cse_opinion',
        category: '시설/실습실',
        title: '시험기간 및 졸업작품 마감 주간에 공학관 304호 실습실 야간 개방 시간을 연장해 주세요!',
        content: `안녕하세요, 현재 졸업작품과 기말 프로젝트를 준비 중인 재학생입니다.\n\n현재 공학관 304호 실습실이 저녁 9시에 마감되어 팀 프로젝트를 진행하거나 실습 장비(GPU 서버)를 활용하는 데 시간이 다소 부족합니다.\n\n졸업작품 심사와 기말고사 기간(11월 중순 ~ 12월 초)만이라도 밤 11시까지 야간 개방을 연장해 주실 수 있을지 학과사무실과 학생회에 건의드립니다.\n공감하시는 학우분들은 '추천' 부탁드립니다!`,
        authorId: 'user_writer',
        authorName: '정학우 (일반재학생)',
        isAnonymous: false,
        isNotice: false,
        createdAt: '2026-11-10T16:40:00+09:00',
        updatedAt: '2026-11-10T17:10:00+09:00',
        attachments: [],
        viewCount: 84,
        likeUserIds: ['user_mod', 'user_notice', 'user_admin'],
        isBlinded: false,
        blindReason: ''
      },
      {
        id: 'post_104',
        spaceId: 'space_cse',
        boardId: 'board_cse_opinion',
        category: '교육과정/수업',
        title: '다음 학기 클라우드 네이티브/백엔드 실무 특강 개설 희망 의견입니다',
        content: `학우 여러분 안녕하세요.\n이번 학기 전공 수업을 들으면서 Docker, 클라우드 배포, 다중게시판 아키텍처 설계 같은 실무형 특강이 방학 중에 열리면 좋겠다는 생각이 들었습니다.\n\n동계 방학 비교과 프로그램으로 실무 프로젝트 특강을 개설해 주시면 많은 학생들이 참여할 것 같습니다!`,
        authorId: 'user_writer',
        authorName: '익명 학우',
        isAnonymous: true,
        isNotice: false,
        createdAt: '2026-11-11T09:15:00+09:00',
        updatedAt: '2026-11-11T09:15:00+09:00',
        attachments: [],
        viewCount: 41,
        likeUserIds: ['user_writer', 'user_mod'],
        isBlinded: false,
        blindReason: ''
      },
      {
        id: 'post_105',
        spaceId: 'space_cse',
        boardId: 'board_cse_free',
        category: '스터디/팀원모집',
        title: '알고리즘 코딩테스트 주 2회 스터디원 2분 모집합니다 (백준/프로그래머스)',
        content: `매주 화/목 오후 6시에 과방 또는 온라인으로 알고리즘 문제 풀이 스터디를 진행하려고 합니다.\n관심 있으신 컴퓨터공학과 학우분은 댓글 남겨주세요!`,
        authorId: 'user_mod',
        authorName: '이학생회장 (게시물관리)',
        isAnonymous: false,
        isNotice: false,
        createdAt: '2026-11-11T10:30:00+09:00',
        updatedAt: '2026-11-11T10:30:00+09:00',
        attachments: [],
        viewCount: 33,
        likeUserIds: ['user_writer'],
        isBlinded: false,
        blindReason: ''
      },
      {
        id: 'post_106',
        spaceId: 'space_cse',
        boardId: 'board_cse_free',
        category: '자유이야기',
        title: '[부적절 게시물 예시] 불법 홍보 및 욕설이 포함된 스팸 게시글입니다',
        content: `이 게시글은 부적절한 게시물 관리(모더레이터/관리자 블라인드 및 신고 처리) 기능을 테스트하기 위한 샘플 스팸 게시글입니다.`,
        authorId: 'user_writer',
        authorName: '익명 학우',
        isAnonymous: true,
        isNotice: false,
        createdAt: '2026-11-11T11:00:00+09:00',
        updatedAt: '2026-11-11T11:00:00+09:00',
        attachments: [],
        viewCount: 19,
        likeUserIds: [],
        isBlinded: true,
        blindReason: '불법 광고 및 커뮤니티 운영규칙 위반으로 게시물 관리자에 의해 블라인드(숨김) 처리되었습니다.'
      },
      {
        id: 'post_107',
        spaceId: 'space_cse',
        boardId: 'board_cse_archive',
        category: '행정양식',
        title: '실습실 GPU 워크스테이션 서버 사용 신청서 양식 공유',
        content: `연구 및 졸업작품 학습용으로 학과 GPU 서버 계정이 필요한 학생은 첨부된 양식을 작성하여 조교실로 제출해 주세요.`,
        authorId: 'user_admin',
        authorName: '박조교 (학과조교)',
        isAnonymous: false,
        isNotice: true,
        createdAt: '2026-11-08T11:00:00+09:00',
        updatedAt: '2026-11-08T11:00:00+09:00',
        attachments: [sampleAttachment3],
        viewCount: 62,
        likeUserIds: ['user_writer'],
        isBlinded: false,
        blindReason: ''
      },

      // 디자인학과 게시글 (타 학과 공간 격리 및 한조교 관리 확인용)
      {
        id: 'post_201',
        spaceId: 'space_design',
        boardId: 'board_dsn_notice',
        category: '졸업전시',
        title: '[디자인학과] 2026 제34회 졸업전시회 도록 촬영 및 부스 배치 안내',
        content: `안녕하세요, 디자인학과 학과사무실 한조교입니다.\n\n디자인학과 구성원 전용 공지사항입니다.\n타 학과(컴퓨터공학과 조교·학생, 경영학과 조교·학생 등) 사용자는 공간 간 접근 차단 정책에 의해 이 게시글을 열람하거나 관리할 수 없으며, 오직 디자인학과 소속 구성원만 열람 가능합니다.`,
        authorId: 'user_design_admin',
        authorName: '한조교 (디자인학과 조교)',
        isAnonymous: false,
        isNotice: true,
        createdAt: '2026-11-10T11:00:00+09:00',
        updatedAt: '2026-11-10T11:00:00+09:00',
        attachments: [],
        viewCount: 45,
        likeUserIds: ['user_design'],
        isBlinded: false,
        blindReason: ''
      },
      // 경영학과 게시글 (경영학과 오조교 공지 확인용)
      {
        id: 'post_301',
        spaceId: 'space_biz',
        boardId: 'board_biz_notice',
        category: '학사공지',
        title: '[경영학과] 2026-2학기 CPA/세무사 고시반 입실 신청 및 장학 안내',
        content: `안녕하세요, 경영학과 학과사무실 오조교입니다.\n\n경영학과 고시반 입실 신청 안내입니다. 경영학과 조교(오조교)는 경영학과 공간에 대한 관리 권한만 가지며, 컴퓨터공학과나 디자인학과 게시판에는 접근 및 관리 권한이 없습니다.`,
        authorId: 'user_biz',
        authorName: '오조교 (경영학과 조교)',
        isAnonymous: false,
        isNotice: true,
        createdAt: '2026-11-10T13:00:00+09:00',
        updatedAt: '2026-11-10T13:00:00+09:00',
        attachments: [],
        viewCount: 38,
        likeUserIds: ['user_biz'],
        isBlinded: false,
        blindReason: ''
      }
    ],

    // 6. 댓글
    comments: [
      {
        id: 'cmt_1',
        postId: 'post_101',
        spaceId: 'space_cse',
        authorId: 'user_writer',
        authorName: '정학우 (일반재학생)',
        content: '교수님! 졸업작품 시연 영상은 MP4 형식으로 제출하면 될까요?',
        createdAt: '2026-11-09T15:10:00+09:00',
        updatedAt: '2026-11-09T15:10:00+09:00',
        isBlinded: false
      },
      {
        id: 'cmt_2',
        postId: 'post_101',
        spaceId: 'space_cse',
        authorId: 'user_notice',
        authorName: '김교수 (학과장/공지담당)',
        content: '네, 해상도 1080p MP4 파일(5분 이내)로 제출하면 됩니다.',
        createdAt: '2026-11-09T16:00:00+09:00',
        updatedAt: '2026-11-09T16:00:00+09:00',
        isBlinded: false
      },
      {
        id: 'cmt_3',
        postId: 'post_103',
        spaceId: 'space_cse',
        authorId: 'user_mod',
        authorName: '이학생회장 (게시물관리)',
        content: '좋은 의견 감사합니다! 학생회에서도 수요 조사를 거쳐 학과사무실에 야간 개방 연장을 건의드리겠습니다.',
        createdAt: '2026-11-10T18:00:00+09:00',
        updatedAt: '2026-11-10T18:00:00+09:00',
        isBlinded: false
      },
      {
        id: 'cmt_4',
        postId: 'post_103',
        spaceId: 'space_cse',
        authorId: 'user_admin',
        authorName: '박조교 (학과조교)',
        content: '학과사무실 확인 완료했습니다. 내주 월요일부터 304호 실습실 야간 개방을 23:00까지 연장 운영하도록 조치하겠습니다.',
        createdAt: '2026-11-11T09:30:00+09:00',
        updatedAt: '2026-11-11T09:30:00+09:00',
        isBlinded: false
      }
    ],

    // 7. 신고 내역 (문제 발생 시 관리자 대응용)
    reports: [
      {
        id: 'rep_1',
        spaceId: 'space_cse',
        targetType: 'POST', // POST | COMMENT
        targetId: 'post_106',
        reporterId: 'user_writer',
        reporterName: '정학우 (일반재학생)',
        reason: '학과 게시판 목적에 맞지 않는 불법 스팸/홍보 게시글입니다.',
        status: 'RESOLVED', // PENDING | RESOLVED
        createdAt: '2026-11-11T11:05:00+09:00',
        resolvedBy: '이학생회장 (게시물관리)',
        resolvedNote: '블라인드(숨김) 조치 완료'
      }
    ],

    // 8. 알림 내역
    notifications: [
      {
        id: 'noti_1',
        userId: 'user_writer',
        spaceId: 'space_cse',
        type: 'COMMENT', // COMMENT | LIKE | NOTICE | MODERATION
        message: '[댓글 알림] 회원님의 건의글 "시험기간 및 졸업작품 마감 주간에..."에 박조교님이 댓글을 남겼습니다.',
        postId: 'post_103',
        isRead: false,
        createdAt: '2026-11-11T09:30:00+09:00'
      },
      {
        id: 'noti_2',
        userId: 'user_writer',
        spaceId: 'space_cse',
        type: 'LIKE',
        message: '[추천 알림] 회원님의 건의글이 학과 구성원 3명의 추천(공감)을 받았습니다.',
        postId: 'post_103',
        isRead: false,
        createdAt: '2026-11-11T10:00:00+09:00'
      },
      {
        id: 'noti_3',
        userId: 'user_writer',
        spaceId: 'space_cse',
        type: 'NOTICE',
        message: '[새 공지] 컴퓨터공학과에 "2026-2학기 컴퓨터공학과 성적우수 및 학과봉사 장학금 신청 안내" 공지가 등록되었습니다.',
        postId: 'post_102',
        isRead: true,
        createdAt: '2026-11-10T14:20:00+09:00'
      }
    ]
  };
}

// IndexedDB 헬퍼 (대용량 첨부파일 및 전체 DB 영구 보관용)
const IDBHelper = {
  open() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        resolve(null);
        return;
      }
      const req = window.indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = () => resolve(null);
    });
  },
  async get(key) {
    const db = await this.open();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  },
  async set(key, value) {
    const db = await this.open();
    if (!db) return false;
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }
};

// 전역 스토리지 매니저
const StorageManager = {
  db: null,
  serverAvailable: false,

  async init() {
    // 1. 로컬 서버(/api/db) 연결 가능 여부 확인 (start-server.ps1 실행 시)
    if (window.location.protocol.startsWith('http')) {
      try {
        const res = await fetch('/api/db', { method: 'GET', cache: 'no-store' });
        if (res.ok) {
          const serverData = await res.json();
          this.serverAvailable = true;
          if (serverData && serverData.users && serverData.spaces) {
            this.db = serverData;
            this.saveLocalMirror(this.db);
            return this.db;
          }
        }
      } catch (_) {
        this.serverAvailable = false;
      }
    }

    // 2. IndexedDB에서 복원 시도
    const idbData = await IDBHelper.get(STORAGE_KEY);
    if (idbData && idbData.users && idbData.spaces) {
      this.db = idbData;
      this.saveLocalMirror(this.db);
      if (this.serverAvailable) this.syncToServer(this.db);
      return this.db;
    }

    // 3. LocalStorage에서 복원 시도
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.users && parsed.spaces) {
          this.db = parsed;
          await IDBHelper.set(STORAGE_KEY, this.db);
          if (this.serverAvailable) this.syncToServer(this.db);
          return this.db;
        }
      }
    } catch (e) {
      console.warn('LocalStorage parse warning:', e);
    }

    // 4. 저장된 데이터가 없으면 초기 시드 데이터 생성 후 영구 저장
    this.db = createInitialDatabase();
    await this.save();
    return this.db;
  },

  saveLocalMirror(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      // 첨부파일 용량이 매우 커서 LocalStorage 한도를 넘더라도 IndexedDB에 안전하게 저장됨
      console.info('LocalStorage quota exceeded; IndexedDB holds full data.');
    }
  },

  async syncToServer(data) {
    if (!this.serverAvailable) return;
    try {
      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } catch (_) {
      // ignore network error
    }
  },

  async save() {
    if (!this.db) return;
    this.db.meta.lastSavedAt = new Date().toISOString();
    this.saveLocalMirror(this.db);
    await IDBHelper.set(STORAGE_KEY, this.db);
    await this.syncToServer(this.db);
  },

  async resetToDefault() {
    this.db = createInitialDatabase();
    await this.save();
    return this.db;
  },

  getSessionUserId() {
    return localStorage.getItem(SESSION_KEY) || 'user_writer';
  },

  setSessionUserId(userId) {
    if (userId) {
      localStorage.setItem(SESSION_KEY, userId);
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  },

  exportJsonBackup() {
    const dataStr = JSON.stringify(this.db, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dept_multiboard_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  async importJsonBackup(jsonText) {
    const parsed = JSON.parse(jsonText);
    if (!parsed || !Array.isArray(parsed.users) || !Array.isArray(parsed.spaces) || !Array.isArray(parsed.posts)) {
      throw new Error('유효한 다중게시판 백업 파일 형식이 아닙니다.');
    }
    this.db = parsed;
    await this.save();
    return this.db;
  }
};

window.StorageManager = StorageManager;
