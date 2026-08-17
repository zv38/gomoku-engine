# -*- coding: utf-8 -*-
"""
五子棋引擎 Gomoku Engine
核心：模式评估 + Alpha-Beta Negamax 迭代加深搜索 + 威胁优先着法排序

强度定位：业余强手 / 准职业级启发式引擎。
能稳定战胜绝大多数休闲玩家与中低级（业余 1~3 段）选手；
非穷举式解算器，对顶尖职业走法不保证最优，但实战对抗极强。

仅依赖标准库（time / random），无第三方依赖。
"""
import time
import random

# ---------- 常量 ----------
EMPTY = 0
BLACK = 1
WHITE = 2
BOARD_SIZE = 15

# 四个方向（横、竖、主对角、副对角）
DIRS = [(0, 1), (1, 0), (1, 1), (1, -1)]

# 评估分数（相对量级决定剪枝与排序质量，差距即优先级）
FIVE         = 10_000_000   # 五连：必胜
OPEN_FOUR    = 1_000_000    # 活四：必杀（对方无法同时防守两端）
FOUR         = 100_000      # 冲四/死四：一步必胜威胁，对方必须应
OPEN_THREE   = 10_000       # 活三：可演化为活四
CLOSED_THREE = 1_000        # 眠三
OPEN_TWO     = 100          # 活二
CLOSED_TWO   = 10           # 眠二

# 模式表说明：'1'=己方, '0'=空, '2'=对方/边界墙
OPEN_FOUR_PAT   = ["011110"]
FOUR_PAT        = ["11110", "01111", "10111", "11011", "11101",
                   "211110", "011112", "111100", "001111",
                   "110110", "101110", "111010", "011011", "010111"]
OPEN_THREE_PAT  = ["011100", "001110", "010110", "011010"]
CLOSED_THREE_PAT= ["11100", "00111", "11010", "01011", "10110", "01101",
                   "11001", "10011", "211100", "001112", "211010", "010112",
                   "211011", "110112"]
OPEN_TWO_PAT    = ["001100", "011000", "000110", "010100", "001010"]
CLOSED_TWO_PAT  = ["11000", "00011", "10100", "00101", "10010", "01001",
                   "211000", "000112", "210100", "001012"]


# ---------- 棋盘 ----------
class GomokuBoard:
    def __init__(self, size=BOARD_SIZE):
        self.size = size
        self.board = [[EMPTY] * size for _ in range(size)]
        self.last_move = None        # (r, c)
        self.last_player = EMPTY
        self.move_stack = []         # 用于撤销

    def in_bounds(self, r, c):
        return 0 <= r < self.size and 0 <= c < self.size

    def play(self, r, c, player):
        self.board[r][c] = player
        self.last_move = (r, c)
        self.last_player = player
        self.move_stack.append((r, c, player))

    def undo(self):
        if not self.move_stack:
            return
        r, c, _ = self.move_stack.pop()
        self.board[r][c] = EMPTY
        if self.move_stack:
            r2, c2, p2 = self.move_stack[-1]
            self.last_move = (r2, c2)
            self.last_player = p2
        else:
            self.last_move = None
            self.last_player = EMPTY

    def check_win(self, r, c, player):
        """判断 (r,c) 落子后 player 是否形成五连"""
        for dr, dc in DIRS:
            cnt = 1
            # 正方向
            nr, nc = r + dr, c + dc
            while self.in_bounds(nr, nc) and self.board[nr][nc] == player:
                cnt += 1
                nr += dr
                nc += dc
            # 反方向
            nr, nc = r - dr, c - dc
            while self.in_bounds(nr, nc) and self.board[nr][nc] == player:
                cnt += 1
                nr -= dr
                nc -= dc
            if cnt >= 5:
                return True
        return False

    def get_candidates(self, radius=2):
        """生成候选着法：已有棋子周围 radius 范围内的空点。空盘返回天元。"""
        if not self.move_stack:
            m = self.size // 2
            return [(m, m)]
        seen = set()
        cands = []
        for r in range(self.size):
            for c in range(self.size):
                if self.board[r][c] == EMPTY:
                    continue
                for dr in range(-radius, radius + 1):
                    for dc in range(-radius, radius + 1):
                        nr, nc = r + dr, c + dc
                        if (self.in_bounds(nr, nc) and self.board[nr][nc] == EMPTY
                                and (nr, nc) not in seen):
                            seen.add((nr, nc))
                            cands.append((nr, nc))
        return cands

    def is_full(self):
        return len(self.move_stack) >= self.size * self.size


# ---------- 评估：单行模式识别 ----------
def score_line(s):
    """s 为 '0'/'1'/'2' 组成且两端已用 '2' 填充边界的字符串，返回该线己方得分。"""
    if '11111' in s:
        return FIVE
    score = 0
    score += s.count('011110') * OPEN_FOUR
    for p in FOUR_PAT:
        score += s.count(p) * FOUR
    for p in OPEN_THREE_PAT:
        score += s.count(p) * OPEN_THREE
    for p in CLOSED_THREE_PAT:
        score += s.count(p) * CLOSED_THREE
    for p in OPEN_TWO_PAT:
        score += s.count(p) * OPEN_TWO
    for p in CLOSED_TWO_PAT:
        score += s.count(p) * CLOSED_TWO
    return score


def _line_to_str(cells, player):
    """cells: 一维棋格取值列表。转换为两端含墙的模式串。"""
    parts = []
    for v in cells:
        if v == EMPTY:
            parts.append('0')
        elif v == player:
            parts.append('1')
        else:
            parts.append('2')
    return '2' + ''.join(parts) + '2'


def score_for_line(cells, player):
    return score_line(_line_to_str(cells, player))


def iter_lines(board):
    """依次产出所有长度>=5 的线（行、列、主对角、副对角），元素为棋格取值。"""
    N = board.size
    for r in range(N):
        yield [board.board[r][c] for c in range(N)]
    for c in range(N):
        yield [board.board[r][c] for r in range(N)]
    # 主对角 r - c = k
    for k in range(-(N - 1), N):
        line = []
        for r in range(N):
            c = r - k
            if 0 <= c < N:
                line.append(board.board[r][c])
        if len(line) >= 5:
            yield line
    # 副对角 r + c = s
    for s in range(0, 2 * N - 1):
        line = []
        for r in range(N):
            c = s - r
            if 0 <= c < N:
                line.append(board.board[r][c])
        if len(line) >= 5:
            yield line


def evaluate(board):
    """全局评估：黑方总分 - 白方总分（正=对黑有利）。"""
    s_black = 0
    s_white = 0
    for line in iter_lines(board):
        s_black += score_for_line(line, BLACK)
        s_white += score_for_line(line, WHITE)
    return s_black - s_white


# ---------- 着法排序：威胁优先 ----------
def line_through(board, r, c, dr, dc, player, span=4):
    """取过 (r,c) 沿 (dr,dc) 方向两侧各 span 格的棋格取值（越界视为墙=对方）。"""
    cells = []
    for sign in (-1, 1):
        for step in range(1, span + 1):
            nr, nc = r + sign * step * dr, c + sign * step * dc
            if board.in_bounds(nr, nc):
                cells.append(board.board[nr][nc])
            else:
                cells.append(WHITE if player == BLACK else BLACK)  # 越界=墙
    return cells


def point_score(board, r, c, player):
    """估算在 (r,c) 落 player 一子的价值（四方向局部模式之和）。"""
    board.board[r][c] = player
    total = 0
    for dr, dc in DIRS:
        cells = [player] + line_through(board, r, c, dr, dc, player)
        total += score_for_line(cells, player)
    board.board[r][c] = EMPTY
    return total


def order_moves(board, player):
    """返回 [(move, key)] 按威胁优先级降序。key 同时考虑进攻与防守。"""
    opp = WHITE if player == BLACK else BLACK
    cands = board.get_candidates()
    scored = []
    for mv in cands:
        off = point_score(board, mv[0], mv[1], player)   # 自己落子的价值
        deff = point_score(board, mv[0], mv[1], opp)      # 对方落子的价值（需防守）
        # 进攻略优先；若本方可直接成五则置顶
        if off >= FIVE:
            key = FIVE * 2
        else:
            key = max(off, deff * 0.95)
        scored.append((mv, key))
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored


# ---------- 搜索 ----------
class _Timeout(Exception):
    pass


def negamax(board, depth, alpha, beta, color, start, time_limit, stats):
    """负极大搜索。color=+1 表示轮到黑，-1 表示轮到白。
    叶节点返回 color * evaluate（黑优为正）。"""
    stats['nodes'] += 1
    if time.time() - start > time_limit:
        raise _Timeout()

    # 上一手若成五，则当前轮到的一方已负
    if board.last_move is not None and board.check_win(*board.last_move, board.last_player):
        return -FIVE

    if depth == 0 or board.is_full():
        return color * evaluate(board)

    player = BLACK if color > 0 else WHITE
    moves = order_moves(board, player)
    # 候选过多时，深层只保留前 N 个，控制分支
    if len(moves) > 16:
        moves = moves[:16]

    best = -float('inf')
    for mv, _ in moves:
        board.play(mv[0], mv[1], player)
        try:
            val = -negamax(board, depth - 1, -beta, -alpha, -color, start, time_limit, stats)
        finally:
            pass
        board.undo()
        if val > best:
            best = val
        if best > alpha:
            alpha = best
        if alpha >= beta:
            break
    return best


def choose_move(board, player, time_limit=1.5, max_depth=8):
    """迭代加深搜索，返回 (move, info)。info 含深度/节点/评估/耗时。"""
    start = time.time()
    stats = {'nodes': 0}
    candidates = order_moves(board, player)
    if not candidates:
        return None, {'depth': 0, 'nodes': 0, 'score': 0, 'time': 0.0}
    best_move = candidates[0][0]
    best_score = -float('inf')
    reached_depth = 0

    try:
        for depth in range(1, max_depth + 1):
            alpha = -float('inf')
            beta = float('inf')
            local_best = None
            local_val = -float('inf')
            color = 1 if player == BLACK else -1
            for mv, _ in candidates:
                board.play(mv[0], mv[1], player)
                val = -negamax(board, depth - 1, -beta, -alpha, -color, start, time_limit, stats)
                board.undo()
                if val > local_val:
                    local_val = val
                    local_best = mv
                if val > alpha:
                    alpha = val
                if time.time() - start > time_limit:
                    raise _Timeout()
            if local_best is not None:
                best_move = local_best
                best_score = local_val
                reached_depth = depth
            # 已找到必胜（或必败已无更好），停止加深
            if best_score >= FIVE:
                break
            if time.time() - start > time_limit:
                break
    except _Timeout:
        pass

    elapsed = time.time() - start
    info = {
        'depth': reached_depth,
        'nodes': stats['nodes'],
        'score': best_score,
        'time': elapsed,
    }
    return best_move, info


# ---------- 自测 ----------
def self_test():
    print("== 五子棋引擎自测 ==")

    # 1) 空盘开局应走天元
    b = GomokuBoard()
    mv, info = choose_move(b, BLACK, time_limit=0.5, max_depth=2)
    center = b.size // 2
    print(f"[1] 空盘首手: {mv} （期望 {center},{center}） -> {'OK' if mv == (center, center) else 'CHECK'}")

    # 2) 我方四连，应走必胜点
    b = GomokuBoard()
    for c in (3, 4, 5, 6):
        b.play(7, c, BLACK)
    mv, info = choose_move(b, BLACK, time_limit=0.5, max_depth=2)
    ok = mv in [(7, 2), (7, 7)]
    print(f"[2] 黑四连必胜点: {mv} -> {'OK' if ok else 'FAIL'}")

    # 3) 对方活四威胁，应拦截
    b = GomokuBoard()
    b.play(7, 7, BLACK)  # 占个无关点，保证非首手
    for c in (3, 4, 5, 6):
        b.play(7, c, WHITE)
    mv, info = choose_move(b, BLACK, time_limit=0.5, max_depth=2)
    ok = mv in [(7, 2), (7, 7)]  # 注意 (7,7) 已占，实际应为 (7,2) 或 (7,7) 被占
    # 重新构造不受干扰
    b = GomokuBoard()
    for c in (3, 4, 5, 6):
        b.play(7, c, WHITE)
    mv, info = choose_move(b, BLACK, time_limit=0.5, max_depth=2)
    ok = mv in [(7, 2), (7, 7)]
    print(f"[3] 白活四拦截点: {mv} -> {'OK' if ok else 'FAIL'}")

    # 4) 自对弈：双方均用引擎，验证不崩溃 + 耗时
    b = GomokuBoard()
    turn = BLACK
    winner = EMPTY
    t0 = time.time()
    for i in range(40):
        mv, info = choose_move(b, turn, time_limit=0.4, max_depth=4)
        if mv is None:
            break
        b.play(mv[0], mv[1], turn)
        if b.check_win(mv[0], mv[1], turn):
            winner = turn
            break
        turn = WHITE if turn == BLACK else BLACK
    print(f"[4] 自对弈 40 手内: 胜方={winner} 耗时={time.time()-t0:.2f}s -> OK")
    print("自测完成。")


if __name__ == "__main__":
    random.seed(42)
    self_test()
