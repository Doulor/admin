use crate::config::Env;
use clap::{Parser, Subcommand};

#[derive(Parser, Debug)]
#[command(name = "geek", version, about = "极客班命令行")]
pub struct Cli {
    /// 目标环境：production（默认）或 preview。优先于 GEEK_ORIGIN。
    #[arg(long, global = true, value_enum)]
    pub env: Option<Env>,
    /// 以 `{ ok, data | error }` 的 JSON 输出，不画登录动画、不带控制字符。
    #[arg(long, global = true)]
    pub json: bool,
    #[command(subcommand)]
    pub command: Command,
}

#[derive(Subcommand, Debug)]
pub enum Command {
    /// 用设备码登录（RFC 8628），打开浏览器确认。
    Login {
        /// 不自动打开浏览器，只打印确认地址。
        #[arg(long)]
        no_browser: bool,
    },
    /// 撤销本机保存的令牌，之后它在服务端立刻失效。
    Logout,
    /// 查看当前登录的账号。
    Whoami,
    /// 论坛相关命令。
    #[command(subcommand)]
    Forum(ForumCommand),
    /// 比赛相关命令。
    #[command(subcommand)]
    Comp(CompCommand),
    /// 比赛组队相关命令。
    #[command(subcommand)]
    Team(TeamCommand),
    /// 公开代码仓库相关命令。
    #[command(subcommand)]
    Repo(RepoCommand),
    /// Agent 技能相关命令。
    #[command(subcommand)]
    Skill(SkillCommand),
}

#[derive(Subcommand, Debug)]
pub enum ForumCommand {
    /// 列出最近的话题。
    List,
    /// 发一个新话题（需要 forum.topic.create 权限节点，注册用户默认没有）。
    Post {
        #[arg(long)]
        title: String,
        #[arg(long)]
        category: String,
        #[arg(long)]
        content: String,
    },
}

#[derive(Subcommand, Debug)]
pub enum CompCommand {
    /// 列出公开的比赛（不需要登录）。
    List,
    /// 我参加的比赛（需要登录，且持有报名或组队任一权限）。
    Mine,
}

#[derive(Subcommand, Debug)]
pub enum TeamCommand {
    /// 申请加入一支队伍（需要 competition.team 权限节点）。
    Apply {
        /// 队伍 id。
        team_id: String,
        #[arg(long, default_value = "")]
        message: String,
    },
}

#[derive(Subcommand, Debug)]
pub enum RepoCommand {
    /// 列出公开代码仓库（不需要登录）。
    List,
}

#[derive(Subcommand, Debug)]
pub enum SkillCommand {
    /// 把内置的 skills/geek/SKILL.md 写到 Agent 的技能目录。
    Install {
        #[arg(long, value_enum, default_value = "all")]
        target: SkillTarget,
    },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, clap::ValueEnum)]
pub enum SkillTarget {
    Claude,
    Codex,
    Omp,
    All,
}
