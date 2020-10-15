import * as fa from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
  AppBar,
  IconButton,
  StyleRules,
  Toolbar,
  Tooltip
} from "@material-ui/core"
import Fade from "@material-ui/core/Fade"
import FormControlLabel from "@material-ui/core/FormControlLabel"
import { Theme, withStyles } from "@material-ui/core/styles"
import createStyles from "@material-ui/core/styles/createStyles"
import Switch from "@material-ui/core/Switch"
import Typography from "@material-ui/core/Typography"
import _ from "lodash"
import React from "react"
import { connect } from "react-redux"

import { save, submit, toggleBot } from "../action/common"
import Session from "../common/session"
import { Key } from "../const/common"
import * as selector from "../functional/selector"
import { defaultAppBar } from "../styles/general"
import { ReduxState } from "../types/redux"
import { Component } from "./component"
import { StatusMessageBox } from "./message_box"

// How long to wait until saving times out
export const saveTimeout = 20000

interface ClassType {
  /** App bar class */
  appBar: string
  /** Grow class for spacing */
  grow: string
  /** Title unit class */
  titleUnit: string
}

interface StyleProps {
  /** Styles of TitleBar */
  classes: ClassType
}

interface StateProps {
  /** Title of TitleBar */
  title: string
  /** DashboardLink of TitleBar */
  dashboardLink: string
  /** InstructionLink of TitleBar */
  instructionLink: string
  /** Whether to show save button or to autosave */
  autosave: boolean
  /** Text for the status banner */
  statusText: string
  /** Whether to hide or show status text */
  statusTextHide: boolean
  /** Whether user has bot enabled */
  botEnabledUser: boolean
  /** Whether bots are enabled system wide */
  botEnabledGlobal: boolean
}

interface DispatchProps {
  /** Triggers save to server */
  save: () => void
  /** Adds submission to the state */
  submit: () => void
  /** Toggles whether bot is enabled */
  toggleBot: () => void
}

interface ButtonInfo {
  /** Name */
  title: string
  /** Icon */
  icon: fa.IconDefinition
  /** Link */
  href?: string
  /** Listener  */
  onClick?: () => void
}

/**
 * Convert info of a button to a renderable button
 *
 * @param button
 * @param titleUnit
 */
function renderButton(button: ButtonInfo, titleUnit: string): JSX.Element {
  const onClick = _.get(button, "onClick", undefined)
  const href = _.get(button, "href", "#")
  const target = "href" in button ? "view_window" : "_self"
  return (
    <Tooltip title={button.title} key={button.title}>
      <IconButton
        className={titleUnit}
        color="secondary"
        onClick={onClick}
        href={href}
        target={target}
        data-testid={button.title}
      >
        <FontAwesomeIcon icon={button.icon} size="xs" />
      </IconButton>
    </Tooltip>
  )
}

type Props = StyleProps & StateProps & DispatchProps

/**
 * Title bar
 */
class TitleBar extends Component<Props> {
  /** Listener for key down events */
  private readonly _keyDownListener: (e: KeyboardEvent) => void

  /**
   * Constructor
   *
   * @param {Object} props: react props
   * @param props
   */
  constructor(props: Props) {
    super(props)
    this._keyDownListener = (e: KeyboardEvent) => {
      if (e.key === Key.S_LOW || e.key === Key.S_UP) {
        e.preventDefault()
        this.props.save()
      }
    }
  }

  /** Mount override */
  public componentDidMount(): void {
    document.addEventListener("keydown", this._keyDownListener)
  }

  /**
   * Unmount
   * Disables asynchronous callbacks
   */
  public componentWillUnmount(): void {
    super.componentWillUnmount()
    document.removeEventListener("keydown", this._keyDownListener)
  }

  /**
   * Handle bot switch toggle
   */
  public handleBotSwitch(): void {
    this.props.toggleBot()
  }

  /**
   * Render function
   *
   * @return {React.Fragment} React fragment
   */
  public render(): JSX.Element {
    const {
      classes,
      title,
      instructionLink,
      dashboardLink,
      autosave,
      statusText,
      statusTextHide,
      botEnabledGlobal,
      botEnabledUser
    } = this.props

    const keyboardLink = "https://doc.scalabel.ai/keyboard.html"

    const buttonInfo: ButtonInfo[] = [
      { title: "Instructions", href: instructionLink, icon: fa.faInfo },
      { title: "Keyboard Usage", href: keyboardLink, icon: fa.faQuestion },
      { title: "Dashboard", href: dashboardLink, icon: fa.faList }
    ]

    const submitHandler = (): void => {
      this.props.submit()
      // Save after submitting, so submit flag is also saved
      if (!autosave) {
        this.props.save()
      }
    }
    buttonInfo.push({
      title: "Submit",
      onClick: submitHandler,
      icon: fa.faCheck
    })

    if (!autosave) {
      const saveHandler = (): void => {
        this.props.save()
      }
      buttonInfo.push({ title: "Save", onClick: saveHandler, icon: fa.faSave })
    }

    const buttons = buttonInfo.map((b) => renderButton(b, classes.titleUnit))

    const botSwitch = botEnabledGlobal ? (
      <FormControlLabel
        control={
          <Switch
            checked={botEnabledUser}
            onChange={this.handleBotSwitch.bind(this)}
          />
        }
        label={"Bot"}
      />
    ) : null

    return (
      <AppBar position="static" className={classes.appBar}>
        <Toolbar variant="dense">
          <Typography variant="h6" noWrap>
            {title}
          </Typography>
          <Fade in={!statusTextHide} timeout={300}>
            <StatusMessageBox>{statusText}</StatusMessageBox>
          </Fade>
          <div className={classes.grow} />
          {botSwitch}
          {buttons}
        </Toolbar>
      </AppBar>
    )
  }
}

const mapStateToProps = (state: ReduxState): StateProps => {
  return {
    title: selector.getPageTitle(state),
    instructionLink: selector.getInstructionLink(state),
    dashboardLink: selector.getDashboardLink(state),
    autosave: selector.getAutosaveFlag(state),
    statusText: selector.getStatusText(state),
    statusTextHide: selector.shouldStatusTextHide(state),
    botEnabledUser: selector.isBotEnabled(state),
    botEnabledGlobal: selector.isBotOnGlobal(state)
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const mapDispatchToProps = () => {
  return {
    save: () => Session.dispatch(save()),
    submit: () => Session.dispatch(submit()),
    toggleBot: () => Session.dispatch(toggleBot())
  }
}

const styles = (
  theme: Theme
): StyleRules<"appBar" | "grow" | "titleUnit", {}> =>
  createStyles({
    appBar: {
      ...defaultAppBar,
      position: "relative",
      height: "100%",
      background: theme.palette.common.black
    },
    grow: {
      flexGrow: 1
    },
    titleUnit: {
      margin: theme.spacing(0) * 0.5
    }
  })

const styledBar = withStyles(styles)(TitleBar)
export default connect(mapStateToProps, mapDispatchToProps)(styledBar)
