import { ReturnCandidate, ReturnCreateFlow } from './ReturnCreateFlow';
import styles from './ReturnCreatePanel.module.css';

interface ReturnCreatePanelProps {
  item: ReturnCandidate;
  onCreated: () => void;
  onAlreadyExists: () => void;
}

export const ReturnCreatePanel = ({ item, onCreated, onAlreadyExists }: ReturnCreatePanelProps) => {
  return (
    <div className={styles.panel}>
      <ReturnCreateFlow item={item} onCreated={onCreated} onAlreadyExists={onAlreadyExists} />
    </div>
  );
};
