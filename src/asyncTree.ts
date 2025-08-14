import {
  Event,
  EventEmitter,
  ProviderResult,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
} from "vscode";

export class AsyncItem extends TreeItem {
  children?: AsyncItem[];
  item?: any;

  constructor({
    label,
    collapsibleState = TreeItemCollapsibleState.Collapsed,
    iconId,
    children,
    contextValue,
    item,
  }: {
    label: string;
    collapsibleState?: TreeItemCollapsibleState;
    iconId?: string;
    children?: AsyncItem[];
    contextValue?: string;
    item?: any;
  }) {
    super(label, children ? collapsibleState : TreeItemCollapsibleState.None);
    this.iconPath = iconId ? new ThemeIcon(iconId) : undefined;
    this.children = children;
    this.contextValue = contextValue;
    this.item = item;
  }
}

export abstract class AsyncTreeDataProvider implements TreeDataProvider<AsyncItem> {
  private _onDidChangeTreeData: EventEmitter<AsyncItem | undefined | null | void> = new EventEmitter();
  readonly onDidChangeTreeData: Event<AsyncItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private data: AsyncItem[] = [];

  constructor() {
    this.refresh();
  }

  getTreeItem(element: AsyncItem): TreeItem {
    return element;
  }

  getChildren(element?: AsyncItem): ProviderResult<AsyncItem[]> {
    return element ? element.children : this.data;
  }

  abstract fetchData(): Promise<AsyncItem[] | undefined>;

  beforeLoad() {}
  afterLoad() {}
  onLoadError(e: Error) {
    console.error(e);
  }

  async refresh() {
    this.beforeLoad();
    try {
      this.data = (await this.fetchData()) ?? [];
      this.afterLoad();
    } catch (e) {
      this.onLoadError(e as Error);
    } finally {
      this._onDidChangeTreeData.fire();
    }
  }
}
