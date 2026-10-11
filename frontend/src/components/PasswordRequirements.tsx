import { evaluarPassword } from '../services/passwordPolicy';
import './PasswordRequirements.css';

export default function PasswordRequirements({ password, id }: { password: string; id: string }) {
  if (!password) return null;
  const { requisitos, nivel, barras } = evaluarPassword(password);
  return (
    <div id={id} className="password-policy">
      <div className="policy-bars" aria-hidden="true">
        {[1, 2, 3].map((n) => <span key={n} className={n <= barras ? 'active' : ''} />)}
      </div>
      <p role="status">Indicador: <strong>{nivel}</strong></p>
      <ul>
        {requisitos.map(({ id: key, label, cumple }) => (
          <li key={key} className={cumple ? 'fulfilled' : ''}>
            <span aria-hidden="true">{cumple ? '✓' : '○'} </span>
            <span className="policy-sr-only">{cumple ? 'Cumplido: ' : 'Pendiente: '}</span>{label}
          </li>
        ))}
      </ul>
    </div>
  );
}
