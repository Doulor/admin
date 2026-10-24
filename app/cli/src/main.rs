mod api;
mod cli;
mod commands;
mod config;
mod output;
mod token_store;
mod ui;

use clap::Parser;
use cli::{
    ApplyCommand, Cli, Command, CompCommand, ForumCommand, RepoCommand, SkillCommand, TeamCommand,
};
use output::{emit, ErrorBody, ExitCode, Outcome};

fn main() {
    let cli = Cli::parse();
    let origin = match config::resolve_origin(cli.env) {
        Ok(origin) => origin,
        Err(error) => {
            let outcome = Outcome::err(
                ExitCode::Usage,
                ErrorBody::new("invalid_origin", error.to_string()),
            );
            std::process::exit(emit(&outcome, cli.json, |_| {}));
        }
    };

    let runtime = tokio::runtime::Runtime::new().expect("无法启动异步运行时");
    let code = runtime.block_on(dispatch(cli.command, origin, cli.json));
    std::process::exit(code);
}

async fn dispatch(command: Command, origin: String, json: bool) -> i32 {
    match command {
        Command::Login { no_browser } => commands::login::run(origin, no_browser, json).await,
        other => {
            let ctx = match commands::Context::load(origin) {
                Ok(ctx) => ctx,
                Err(error) => {
                    return emit(
                        &Outcome::err(
                            ExitCode::Other,
                            ErrorBody::new("context_error", error.to_string()),
                        ),
                        json,
                        |_| {},
                    )
                }
            };
            match other {
                Command::Login { .. } => unreachable!(),
                Command::Logout => commands::logout::run(&ctx, json).await,
                Command::Whoami => commands::whoami::run(&ctx, json).await,
                Command::Status => commands::status::run(&ctx, json).await,
                Command::Forum(ForumCommand::List) => commands::forum::list(&ctx, json).await,
                Command::Forum(ForumCommand::Show { topic_id }) => {
                    commands::forum::show(&ctx, topic_id, json).await
                }
                Command::Forum(ForumCommand::Post {
                    title,
                    category,
                    content,
                }) => commands::forum::post(&ctx, title, category, content, json).await,
                Command::Forum(ForumCommand::Reply { topic_id, content }) => {
                    commands::forum::reply(&ctx, topic_id, content, json).await
                }
                Command::Comp(CompCommand::List) => commands::comp::list(&ctx, json).await,
                Command::Comp(CompCommand::Show { id }) => {
                    commands::comp::show(&ctx, id, json).await
                }
                Command::Comp(CompCommand::Mine) => commands::comp::mine(&ctx, json).await,
                Command::Comp(CompCommand::Signup {
                    id,
                    note,
                    looking_for_team,
                }) => commands::comp::signup(&ctx, id, note, looking_for_team, json).await,
                Command::Comp(CompCommand::Ladder { id }) => {
                    commands::comp::ladder(&ctx, id, json).await
                }
                Command::Team(TeamCommand::Create {
                    competition_id,
                    name,
                    slogan,
                }) => commands::team::create(&ctx, competition_id, name, slogan, json).await,
                Command::Team(TeamCommand::Apply { team_id, message }) => {
                    commands::team::apply(&ctx, team_id, message, json).await
                }
                Command::Repo(RepoCommand::List) => commands::repo::list(&ctx, json).await,
                Command::Apply(ApplyCommand::Status) => commands::apply::status(&ctx, json).await,
                Command::Skill(SkillCommand::Install { target }) => {
                    commands::skill::install(target, json)
                }
            }
        }
    }
}
