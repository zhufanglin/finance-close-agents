# -*- coding: utf-8 -*-
"""远程服务器 SSH 工具：探测 + 执行命令（paramiko）"""
import sys, paramiko, getpass

HOST = "154.64.255.36"
USER = "root"
PWD = "uiucA1zXujiEoBB2"

def connect():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, 22, USER, PWD, timeout=20, banner_timeout=20)
    return c

def run(cmd, timeout=120):
    c = connect()
    try:
        stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
        out = stdout.read().decode('utf-8', 'replace')
        err = stderr.read().decode('utf-8', 'replace')
        code = stdout.channel.recv_exit_status()
        return code, out, err
    finally:
        c.close()

def run_interactive(cmd, timeout=120):
    """交互式执行（sudo 密码等）"""
    c = connect()
    try:
        stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout, get_pty=True)
        out = stdout.read().decode('utf-8', 'replace')
        err = stderr.read().decode('utf-8', 'replace')
        code = stdout.channel.recv_exit_status()
        return code, out, err
    finally:
        c.close()

if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "probe"
    if mode == "probe":
        cmds = [
            ("系统", "cat /etc/os-release | head -2; uname -m"),
            ("CPU/内存", "nproc; free -h | head -2"),
            ("磁盘", "df -h / | tail -1"),
            ("Docker", "docker --version 2>&1 | head -1; docker compose version 2>&1 | head -1"),
            ("已装服务", "systemctl list-units --type=service --state=running 2>/dev/null | grep -vE 'systemd|dbus|ssh|network|cron|getty|rsyslog|udev|user@|journal' | head -20"),
            ("端口监听", "ss -tlnp 2>/dev/null | head -20 || netstat -tlnp 2>/dev/null | head -20"),
            ("域名指向", "curl -s -o /dev/null -w '%{http_code}' http://154.64.255.36 --max-time 5; echo ' <- 直接IP HTTP状态'"),
            ("现有web服务", "ps aux | grep -iE 'nginx|apache|caddy|httpd|docker' | grep -v grep | head -10"),
        ]
        for name, cmd in cmds:
            code, out, err = run(cmd, timeout=60)
            print(f"===== {name} =====")
            print((out + err).strip() or "(无输出)")
    elif mode == "exec":
        cmd = sys.argv[2]
        timeout = int(sys.argv[3]) if len(sys.argv) > 3 else 300
        code, out, err = run_interactive(cmd, timeout=timeout)
        print(out)
        if err.strip():
            print("[stderr]", err)
        sys.exit(code)
