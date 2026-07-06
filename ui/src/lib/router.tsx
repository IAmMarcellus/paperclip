import * as React from "react";
import * as RouterDom from "react-router-dom";
import type { NavigateOptions, To } from "react-router-dom";
import type { Issue } from "@paperclipai/shared";
import { useCompany } from "@/context/CompanyContext";
import { IssueLinkQuicklook } from "@/components/IssueLinkQuicklook";
import {
  applyCompanyPrefix,
  extractCompanyPrefixFromPath,
  normalizeCompanyPrefix,
} from "@/lib/company-routes";
import { parseIssuePathIdFromPath } from "@/lib/issue-reference";

function resolveTo(to: To, companyPrefix: string | null): To {
  if (typeof to === "string") {
    return applyCompanyPrefix(to, companyPrefix);
  }

  if (to.pathname && to.pathname.startsWith("/")) {
    const pathname = applyCompanyPrefix(to.pathname, companyPrefix);
    if (pathname !== to.pathname) {
      return { ...to, pathname };
    }
  }

  return to;
}

function useActiveCompanyPrefix(): string | null {
  const { selectedCompany } = useCompany();
  const params = RouterDom.useParams<{ companyPrefix?: string }>();
  const location = RouterDom.useLocation();

  if (params.companyPrefix) {
    return normalizeCompanyPrefix(params.companyPrefix);
  }

  const pathPrefix = extractCompanyPrefixFromPath(location.pathname);
  if (pathPrefix) return pathPrefix;

  return selectedCompany ? normalizeCompanyPrefix(selectedCompany.issuePrefix) : null;
}

export * from "react-router-dom";

// Tracks whether we are already rendering inside a <Link>/<a>. A nested <a> is
// invalid HTML — the browser un-nests it, which destabilises any Popover
// anchored to the outer link (this previously crashed the page with a
// "Maximum update depth exceeded" loop). Nested issue mentions read this and
// render as a non-anchor instead (see IssueReferencePill).
const InsideLinkContext = React.createContext(false);

/** True when rendered inside another `<Link>` — used to avoid nesting anchors. */
export function useInsideLink(): boolean {
  return React.useContext(InsideLinkContext);
}

type CompanyLinkProps = React.ComponentProps<typeof RouterDom.Link> & {
  disableIssueQuicklook?: boolean;
  issuePrefetch?: Issue | null;
  issueQuicklookSide?: React.ComponentProps<typeof IssueLinkQuicklook>["issueQuicklookSide"];
  issueQuicklookAlign?: React.ComponentProps<typeof IssueLinkQuicklook>["issueQuicklookAlign"];
};

export const Link = React.forwardRef<HTMLAnchorElement, CompanyLinkProps>(
  function CompanyLink({
    to,
    children,
    disableIssueQuicklook = false,
    issuePrefetch = null,
    issueQuicklookSide,
    issueQuicklookAlign,
    ...props
  }, ref) {
    const insideLink = React.useContext(InsideLinkContext);
    const companyPrefix = useActiveCompanyPrefix();

    // A link nested inside another link is invalid HTML — the browser un-nests
    // it, which destabilises any Popover anchored to the outer link (this
    // previously crashed the page with "Maximum update depth exceeded"). Render
    // a non-navigable span that keeps the visual + a11y attributes; the
    // enclosing link owns the click. (IssueReferencePill does the same for its
    // mention chips; this is the general safety net, e.g. MarkdownBody mentions.)
    if (insideLink) {
      const spanProps: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(props)) {
        if (
          key === "className" ||
          key === "title" ||
          key === "id" ||
          key === "style" ||
          key === "role" ||
          key.startsWith("data-") ||
          key.startsWith("aria-")
        ) {
          spanProps[key] = value;
        }
      }
      return <span {...spanProps}>{children}</span>;
    }

    const resolvedTo = resolveTo(to, companyPrefix);
    const issuePathId = parseIssuePathIdFromPath(typeof resolvedTo === "string" ? resolvedTo : resolvedTo.pathname);

    // Mark descendants as "inside a link" so any nested link degrades (above).
    const content = <InsideLinkContext.Provider value={true}>{children}</InsideLinkContext.Provider>;

    if (issuePathId) {
      return (
        <IssueLinkQuicklook
          ref={ref}
          to={resolvedTo}
          issuePathId={issuePathId}
          disableIssueQuicklook={disableIssueQuicklook}
          issuePrefetch={issuePrefetch}
          issueQuicklookSide={issueQuicklookSide}
          issueQuicklookAlign={issueQuicklookAlign}
          {...props}
        >
          {content}
        </IssueLinkQuicklook>
      );
    }

    return (
      <RouterDom.Link ref={ref} to={resolvedTo} {...props}>
        {content}
      </RouterDom.Link>
    );
  },
);

export const NavLink = React.forwardRef<HTMLAnchorElement, React.ComponentProps<typeof RouterDom.NavLink>>(
  function CompanyNavLink({ to, ...props }, ref) {
    const companyPrefix = useActiveCompanyPrefix();
    return <RouterDom.NavLink ref={ref} to={resolveTo(to, companyPrefix)} {...props} />;
  },
);

export function Navigate({ to, ...props }: React.ComponentProps<typeof RouterDom.Navigate>) {
  const companyPrefix = useActiveCompanyPrefix();
  return <RouterDom.Navigate to={resolveTo(to, companyPrefix)} {...props} />;
}

export function useNavigate(): ReturnType<typeof RouterDom.useNavigate> {
  const navigate = RouterDom.useNavigate();
  const companyPrefix = useActiveCompanyPrefix();

  return React.useCallback(
    ((to: To | number, options?: NavigateOptions) => {
      if (typeof to === "number") {
        navigate(to);
        return;
      }
      navigate(resolveTo(to, companyPrefix), options);
    }) as ReturnType<typeof RouterDom.useNavigate>,
    [navigate, companyPrefix],
  );
}
