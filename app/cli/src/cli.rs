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
    /// 本机登录状态：令牌来自哪一层、源站、服务端连不连得上、令牌是否有效、版本号。不要求已登录。
    Status,
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
    /// 招新投递相关命令。
    #[command(subcommand)]
    Apply(ApplyCommand),
    /// Agent 技能相关命令。
    #[command(subcommand)]
    Skill(SkillCommand),
}

#[derive(Subcommand, Debug)]
pub enum ForumCommand {
    /// 列出最近的话题。
    List,
    /// 看一个话题的全部帖子（不需要登录）。
    Show {
        /// 话题 id（例如 t42）。
        topic_id: String,
    },
    /// 发一个新话题（需要 forum.topic.create 权限节点，注册用户默认没有）。
    Post {
        #[arg(long)]
        title: String,
        #[arg(long)]
        category: String,
        #[arg(long)]
        content: String,
    },
    /// 回复一个话题（需要 forum.reply.create 权限节点，注册用户默认没有）。
    Reply {
        /// 话题 id（例如 t42）。
        topic_id: String,
        #[arg(long)]
        content: String,
    },
}

#[derive(Subcommand, Debug)]
pub enum CompCommand {
    /// 列出公开的比赛（不需要登录）。
    List,
    /// 看一场比赛（公开，不需要登录）。
    Show {
        /// 比赛 id。
        id: String,
    },
    /// 我参加的比赛（需要登录，且持有报名或组队任一权限）。
    Mine,
    /// 报名一场比赛（需要 competition.signup 权限节点，注册用户默认没有）。
    Signup {
        /// 比赛 id。
        id: String,
        #[arg(long, default_value = "")]
        note: String,
        #[arg(long)]
        looking_for_team: bool,
    },
    /// 看一场比赛的榜（需要登录，且持有报名或组队任一权限）。
    Ladder {
        /// 比赛 id。
        id: String,
    },
}

#[derive(Subcommand, Debug)]
pub enum TeamCommand {
    /// 为一场比赛建一支新队伍（需要 competition.team 权限节点）。
    Create {
        /// 比赛 id。
        competition_id: String,
        #[arg(long)]
        name: String,
        #[arg(long, default_value = "")]
        slogan: String,
    },
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
pub enum ApplyCommand {
    /// 我的投递状态（按登录邮箱匹配，账号没绑邮箱时是空列表；只有 id、status、created_at）。
    Status,
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

#[cfg(test)]
mod tests {
    use super::*;

    /// `Cli::try_parse_from` 不碰网络、不读环境变量来源之外的任何东西，只核对 clap 的参数定义：
    /// 子命令名、必填/可选参数、长选项名和默认值都是这次新加的八个命令期望的那样。
    fn parse(args: &[&str]) -> Cli {
        let mut full = vec!["geek"];
        full.extend_from_slice(args);
        Cli::try_parse_from(full).unwrap_or_else(|error| panic!("解析 {args:?} 失败：{error}"))
    }

    #[test]
    fn status_takes_no_arguments() {
        assert!(matches!(parse(&["status"]).command, Command::Status));
    }

    #[test]
    fn forum_show_takes_a_positional_topic_id() {
        match parse(&["forum", "show", "t42"]).command {
            Command::Forum(ForumCommand::Show { topic_id }) => assert_eq!(topic_id, "t42"),
            other => panic!("预期 Forum(Show)，得到 {other:?}"),
        }
    }

    #[test]
    fn forum_reply_requires_content_and_keeps_topic_id_positional() {
        match parse(&["forum", "reply", "t42", "--content", "+1"]).command {
            Command::Forum(ForumCommand::Reply { topic_id, content }) => {
                assert_eq!(topic_id, "t42");
                assert_eq!(content, "+1");
            }
            other => panic!("预期 Forum(Reply)，得到 {other:?}"),
        }
        assert!(Cli::try_parse_from(["geek", "forum", "reply", "t42"]).is_err());
    }

    #[test]
    fn comp_show_takes_a_positional_id() {
        match parse(&["comp", "show", "c1"]).command {
            Command::Comp(CompCommand::Show { id }) => assert_eq!(id, "c1"),
            other => panic!("预期 Comp(Show)，得到 {other:?}"),
        }
    }

    #[test]
    fn comp_signup_defaults_note_empty_and_looking_for_team_false() {
        match parse(&["comp", "signup", "c1"]).command {
            Command::Comp(CompCommand::Signup {
                id,
                note,
                looking_for_team,
            }) => {
                assert_eq!(id, "c1");
                assert_eq!(note, "");
                assert!(!looking_for_team);
            }
            other => panic!("预期 Comp(Signup)，得到 {other:?}"),
        }
        match parse(&[
            "comp",
            "signup",
            "c1",
            "--note",
            "找队友",
            "--looking-for-team",
        ])
        .command
        {
            Command::Comp(CompCommand::Signup {
                note,
                looking_for_team,
                ..
            }) => {
                assert_eq!(note, "找队友");
                assert!(looking_for_team);
            }
            other => panic!("预期 Comp(Signup)，得到 {other:?}"),
        }
    }

    #[test]
    fn comp_ladder_takes_a_positional_id() {
        match parse(&["comp", "ladder", "c1"]).command {
            Command::Comp(CompCommand::Ladder { id }) => assert_eq!(id, "c1"),
            other => panic!("预期 Comp(Ladder)，得到 {other:?}"),
        }
    }

    #[test]
    fn team_create_requires_name_and_defaults_slogan_empty() {
        match parse(&["team", "create", "c1", "--name", "夜猫子"]).command {
            Command::Team(TeamCommand::Create {
                competition_id,
                name,
                slogan,
            }) => {
                assert_eq!(competition_id, "c1");
                assert_eq!(name, "夜猫子");
                assert_eq!(slogan, "");
            }
            other => panic!("预期 Team(Create)，得到 {other:?}"),
        }
        assert!(Cli::try_parse_from(["geek", "team", "create", "c1"]).is_err());
    }

    #[test]
    fn apply_status_takes_no_arguments() {
        assert!(matches!(
            parse(&["apply", "status"]).command,
            Command::Apply(ApplyCommand::Status)
        ));
    }

    #[test]
    fn json_flag_is_global_and_works_after_the_subcommand_too() {
        assert!(parse(&["--json", "status"]).json);
        assert!(parse(&["status", "--json"]).json);
        assert!(!parse(&["status"]).json);
    }
}
